// Vercel serverless function — Razorpay webhook (payment.captured).
//
// Security: verifies the X-Razorpay-Signature HMAC against the RAW request
// body and rejects on mismatch. Idempotent by razorpay_payment_id. On a
// captured payment it marks the payments row paid and upserts an entitlement,
// EXTENDING an active same-or-lower plan from its expires_at, else starting now.
//
// Raw body: we disable Vercel's body parser (config below) and read the stream
// ourselves, so the bytes we HMAC are exactly what Razorpay signed.
//
// Pure helpers (verifySignature, computeDates) are exported for unit tests and
// take an explicit `now`, so tests can pin dates (no Date.now in assertions).
const crypto = require('crypto');
const { PRICES, planRank } = require('./_lib/prices');
const { rest } = require('./_lib/supa');

function verifySignature(raw, signature, secret) {
  if (!raw || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(a, b); } catch (e) { return false; }
}

// existing: newest active {plan, expires_at(ISO)} or null. Returns ISO dates.
function computeDates(existing, newPlan, days, nowMs) {
  let baseMs = nowMs;
  if (existing && existing.expires_at) {
    const exp = new Date(existing.expires_at).getTime();
    // Extend only when the current plan is active AND same-or-lower rank
    // (renewals and upgrades stack; a downgrade starts fresh).
    if (exp > nowMs && planRank(existing.plan) <= planRank(newPlan)) baseMs = exp;
  }
  return {
    starts_at: new Date(nowMs).toISOString(),
    expires_at: new Date(baseMs + days * 86400000).toISOString()
  };
}

function readRaw(req) {
  return new Promise((resolve) => {
    if (typeof req.body === 'string') return resolve(req.body);
    let data = '', any = false;
    req.on('data', c => { any = true; data += c; });
    req.on('end', () => resolve(any ? data : (req.body ? JSON.stringify(req.body) : '')));
    req.on('error', () => resolve(req.body ? JSON.stringify(req.body) : ''));
  });
}

async function maybeSendEmail(price, expiresIso, pay) {
  const key = process.env.RESEND_API_KEY;
  const to = pay && pay.email;
  if (!key || !to) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Amazon Seller Tools <onboarding@resend.dev>',
      to: [to],
      subject: price.label + ' activated',
      html: '<p>Thank you! Your <b>' + price.label + '</b> plan is active until '
        + new Date(expiresIso).toDateString() + '.</p>'
    })
  });
}

// Shared by payment.captured and subscription.charged: dedupe by payment id,
// record the payment row, and grant/extend the entitlement. `source` marks
// where the money came from ('razorpay' one-time, 'razorpay_sub' auto-renew).
async function recordPaidAndEntitle({ paymentId, orderId, userId, price, amountPaise, evt, pay, source }) {
  // Idempotency: if we already recorded this payment as paid, stop. Both the
  // payment.captured and subscription.charged events fire for one sub charge —
  // whichever lands second is dropped here.
  const dupRes = await rest('GET', '/payments?select=id,status&razorpay_payment_id=eq.'
    + encodeURIComponent(paymentId) + '&limit=1');
  if (dupRes.ok) {
    const rows = await dupRes.json();
    if (rows && rows[0] && rows[0].status === 'paid') return { duplicate: true };
  }

  // Mark the pending order row paid (or insert one if it's missing).
  let updated = false;
  if (orderId) {
    const up = await rest('PATCH', '/payments?razorpay_order_id=eq.' + encodeURIComponent(orderId),
      { razorpay_payment_id: paymentId, status: 'paid', raw: evt }, { Prefer: 'return=representation' });
    if (up.ok) { const r = await up.json(); updated = Array.isArray(r) && r.length > 0; }
  }
  if (!updated) {
    await rest('POST', '/payments', {
      user_id: userId, razorpay_order_id: orderId, razorpay_payment_id: paymentId,
      amount_paise: amountPaise, plan: price.plan, period: price.period, status: 'paid', raw: evt
    });
  }

  // Entitlement dates: extend the newest active same-or-lower plan, else now.
  const entRes = await rest('GET', '/entitlements?select=plan,expires_at&user_id=eq.'
    + encodeURIComponent(userId) + '&order=created_at.desc&limit=10');
  let existing = null;
  if (entRes.ok) {
    const rows = await entRes.json();
    const now = Date.now();
    existing = (rows || []).find(r => !r.expires_at || new Date(r.expires_at).getTime() > now) || null;
  }
  const dates = computeDates(existing, price.plan, price.days, Date.now());
  await rest('POST', '/entitlements', {
    user_id: userId, plan: price.plan, source: source || 'razorpay',
    starts_at: dates.starts_at, expires_at: dates.expires_at, payment_id: paymentId
  });

  // Confirmation email is best-effort — never fail the webhook on it.
  try { await maybeSendEmail(price, dates.expires_at, pay); } catch (e) { /* ignore */ }
  return { duplicate: false };
}

// Subscription lifecycle events → our subscriptions-row status.
const SUB_STATUS = {
  'subscription.activated': 'active',
  'subscription.charged': 'active',
  'subscription.cancelled': 'cancelled',
  'subscription.completed': 'completed',
  'subscription.halted': 'halted',
  'subscription.paused': 'paused',
  'subscription.resumed': 'active',
};

async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end();

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const sig = req.headers['x-razorpay-signature'];
    const raw = await readRaw(req);

    if (!verifySignature(raw, sig, secret)) return res.status(400).json({ error: 'bad_signature' });

    let evt; try { evt = JSON.parse(raw); } catch (e) { return res.status(400).json({ error: 'bad_json' }); }
    if (!evt) return res.status(200).json({ ok: true, ignored: true });

    // ---- subscription lifecycle + renewal charges ----
    if (SUB_STATUS[evt.event]) {
      const sub = evt.payload && evt.payload.subscription && evt.payload.subscription.entity;
      if (!sub || !sub.id) return res.status(200).json({ ok: true, ignored: true });

      const patch = { status: SUB_STATUS[evt.event] };
      if (sub.current_end) patch.current_end = new Date(sub.current_end * 1000).toISOString();
      await rest('PATCH', '/subscriptions?rzp_subscription_id=eq.' + encodeURIComponent(sub.id), patch);

      if (evt.event !== 'subscription.charged') return res.status(200).json({ ok: true });

      const pay = evt.payload && evt.payload.payment && evt.payload.payment.entity;
      const notes = (sub.notes && sub.notes.plan_key) ? sub.notes : ((pay && pay.notes) || {});
      const price = PRICES[notes.plan_key];
      const userId = notes.user_id;
      if (!pay || !price || !userId) return res.status(200).json({ ok: true, ignored: 'no_notes' });

      const r = await recordPaidAndEntitle({
        paymentId: pay.id, orderId: pay.order_id || null, userId, price,
        amountPaise: pay.amount, evt, pay, source: 'razorpay_sub'
      });
      return res.status(200).json({ ok: true, duplicate: !!r.duplicate });
    }

    // ---- one-time payments (and the payment.captured echo of sub charges,
    //      which dedupes inside recordPaidAndEntitle) ----
    if (evt.event !== 'payment.captured') return res.status(200).json({ ok: true, ignored: true });

    const pay = evt.payload && evt.payload.payment && evt.payload.payment.entity;
    if (!pay) return res.status(200).json({ ok: true, ignored: true });

    const paymentId = pay.id, orderId = pay.order_id, notes = pay.notes || {};
    const price = PRICES[notes.plan_key];
    const userId = notes.user_id;
    if (!price || !userId) return res.status(200).json({ ok: true, ignored: 'no_notes' });

    const r = await recordPaidAndEntitle({
      paymentId, orderId, userId, price, amountPaise: pay.amount, evt, pay,
      source: pay.invoice_id ? 'razorpay_sub' : 'razorpay'
    });
    return res.status(200).json({ ok: true, duplicate: !!r.duplicate });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
module.exports.verifySignature = verifySignature;
module.exports.computeDates = computeDates;
module.exports.SUB_STATUS = SUB_STATUS;
