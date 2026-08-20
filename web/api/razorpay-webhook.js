// Vercel serverless function — Razorpay webhook (payment.captured).
//
// Security: verifies the X-Razorpay-Signature HMAC against the RAW request
// body and rejects on mismatch. Idempotent by razorpay_payment_id. On a
// captured payment it marks the payments row paid and upserts an entitlement,
// EXTENDING an active same-or-lower plan from its expires_at, else starting now.
//
// WHAT WE TRUST: only rows this server wrote. `notes` on a Razorpay payment
// are attacker-controllable (Checkout can attach arbitrary notes, and a
// payment can be raised without one of our orders), so the plan, the amount
// and the beneficiary are ALWAYS resolved from our own payments /
// subscriptions row — keyed by razorpay_order_id / rzp_subscription_id — and
// the captured amount must equal that plan's price. A payment we have no
// record of grants nothing.
//
// Raw body: we disable Vercel's body parser (config below) and read the stream
// ourselves, so the bytes we HMAC are exactly what Razorpay signed.
//
// Pure helpers (verifySignature, computeDates, priceFor, amountOk) are
// exported for unit tests and take an explicit `now`, so tests can pin dates.
const crypto = require('crypto');
const { PRICES, planRank } = require('./_lib/prices');
const { rest } = require('./_lib/supa');

// Our (plan, period) → the canonical price entry. Never derived from notes.
function priceFor(plan, period) {
  const key = Object.keys(PRICES).find(k => PRICES[k].plan === plan && PRICES[k].period === period);
  return key ? PRICES[key] : null;
}
function currencyOk(pay) {
  return !!pay && (!pay.currency || String(pay.currency).toUpperCase() === 'INR');
}
// The captured payment must be exactly the plan's price, in INR. Used for
// subscription charges only; one-time payments are checked against the amount
// recorded on their own order, so a price change can't strand them.
function amountOk(price, pay) {
  if (!price || !pay) return false;
  if (!currencyOk(pay)) return false;
  return Number(pay.amount) === Number(price.amount_paise);
}

function verifySignature(raw, signature, secret) {
  if (!raw || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(a, b); } catch (e) { return false; }
}

// existing: newest active {plan, expires_at(ISO), per_day_paise?} or null.
// Same plan → a renewal: extends 1:1 from the current expiry. Upgrade
// (existing rank below the new plan) → the remaining time converts by
// VALUE: the rupees left on the old plan buy days at the new plan's
// per-day price. A 1:1 upgrade stack let ₹999 of yearly Starter turn
// into a year of Pro; value conversion keeps every paid rupee and
// closes that hole. Downgrades start fresh — a cheaper plan must not
// consume a costlier one's time.
function computeDates(existing, newPlan, days, nowMs, newPerDayPaise) {
  let expiresMs = nowMs + days * 86400000;
  if (existing && existing.expires_at) {
    const exp = new Date(existing.expires_at).getTime();
    if (exp > nowMs) {
      const oldRank = planRank(existing.plan), newRank = planRank(newPlan);
      if (oldRank === newRank) expiresMs = exp + days * 86400000;
      else if (oldRank < newRank) {
        const ratio = (existing.per_day_paise > 0 && newPerDayPaise > 0)
          ? Math.min(1, existing.per_day_paise / newPerDayPaise) : 0;
        expiresMs = nowMs + days * 86400000 + Math.floor((exp - nowMs) * ratio);
      }
    }
  }
  return {
    starts_at: new Date(nowMs).toISOString(),
    expires_at: new Date(expiresMs).toISOString()
  };
}

// What one day of the buyer's CURRENT entitlement cost them: the linked
// payment's amount over the entitlement's span, else the plan's monthly
// rate (admin grants and rows from before payment linkage). Never a
// retry-worthy failure — a missing number only means no upgrade bonus
// math, so fall back rather than block the grant.
async function perDayPaiseOf(existing) {
  if (!existing) return null;
  try {
    const spanMs = (existing.starts_at && existing.expires_at)
      ? new Date(existing.expires_at).getTime() - new Date(existing.starts_at).getTime() : 0;
    if (existing.payment_id && spanMs > 0) {
      const pRes = await rest('GET', '/payments?select=amount_paise&razorpay_payment_id=eq.'
        + encodeURIComponent(existing.payment_id) + '&limit=1');
      if (pRes.ok) {
        const p = ((await pRes.json()) || [])[0];
        if (p && p.amount_paise > 0) return p.amount_paise / (spanMs / 86400000);
      }
    }
  } catch (e) { /* fall through */ }
  const mk = Object.keys(PRICES).find(k => PRICES[k].plan === existing.plan && PRICES[k].period === 'monthly');
  return mk ? PRICES[mk].amount_paise / PRICES[mk].days : null;
}

// A Pro purchase supersedes a Starter auto-renewal: the buyer's leftover
// Starter time has just been converted into Pro days, so the old mandate
// must stop charging — otherwise they pay for both plans every month.
// Immediate cancel, not cycle end: the running period's value is already
// credited. Best-effort by design — the account page still lists every
// mandate with its own cancel button if this misses.
async function cancelLowerSubs(userId, newPlan) {
  const KEY = process.env.RAZORPAY_KEY_ID, SEC = process.env.RAZORPAY_KEY_SECRET;
  if (!KEY || !SEC) return;
  const r = await rest('GET', '/subscriptions?select=rzp_subscription_id,plan,status&user_id=eq.'
    + encodeURIComponent(userId) + '&status=in.(active,created,authenticated)');
  if (!r.ok) return;
  for (const sub of (await r.json()) || []) {
    if (!sub.rzp_subscription_id || planRank(sub.plan) >= planRank(newPlan)) continue;
    try {
      const c = await fetch('https://api.razorpay.com/v1/subscriptions/'
        + encodeURIComponent(sub.rzp_subscription_id) + '/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(KEY + ':' + SEC).toString('base64') },
        body: JSON.stringify({ cancel_at_cycle_end: 0 })
      });
      if (c.ok) {
        await rest('PATCH', '/subscriptions?rzp_subscription_id=eq.'
          + encodeURIComponent(sub.rzp_subscription_id), { status: 'cancelled' });
      }
    } catch (e) { /* best-effort */ }
  }
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
      from: 'Seller Tools India <onboarding@resend.dev>',
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
  // Idempotency is decided by the thing that matters — the entitlement — not
  // by the payments flag. Keying off payments.status='paid' meant a grant that
  // failed after the row was flipped could never be retried: every redelivery
  // saw "paid" and reported duplicate.
  const dupRes = await rest('GET', '/entitlements?select=id&payment_id=eq.'
    + encodeURIComponent(paymentId) + '&limit=1');
  // Fail CLOSED: if we can't tell whether this payment was already granted,
  // ask Razorpay to retry rather than risk granting the period twice.
  if (!dupRes.ok) return { retry: true };
  const dupRows = await dupRes.json();
  if (dupRows && dupRows[0]) return { duplicate: true };

  // Money already refunded must never become access, whichever event order
  // Razorpay delivers in.
  if (orderId) {
    const stRes = await rest('GET', '/payments?select=status&razorpay_order_id=eq.'
      + encodeURIComponent(orderId) + '&limit=1');
    if (!stRes.ok) return { retry: true };
    const st = ((await stRes.json()) || [])[0];
    if (st && st.status === 'refunded') return { refunded: true };
  }

  // Entitlement dates: extend the FURTHEST-dated live same-or-lower plan.
  // Taking the newest-created row instead would compute a renewal from a
  // short admin top-up and silently delete months of paid time.
  const entRes = await rest('GET', '/entitlements?select=plan,expires_at,starts_at,payment_id&user_id=eq.'
    + encodeURIComponent(userId) + '&order=expires_at.desc.nullsfirst&limit=100');
  if (!entRes.ok) return { retry: true };
  let existing = null;
  {
    const rows = await entRes.json();
    const now = Date.now();
    const live = (rows || []).filter(r => !r.expires_at || new Date(r.expires_at).getTime() > now);
    existing = live.find(r => !r.expires_at) || live[0] || null;   // null expiry = perpetual
  }
  if (existing) existing.per_day_paise = await perDayPaiseOf(existing);
  const dates = computeDates(existing, price.plan, price.days, Date.now(), price.amount_paise / price.days);

  // GRANT FIRST, then record the money. entitlements.payment_id is UNIQUE, and
  // on_conflict names it so PostgREST targets that constraint rather than the
  // primary key — a concurrent duplicate delivery becomes a no-op instead of a
  // second paid period. Anything else is a real failure: return retry so
  // Razorpay redelivers, because access is the part the customer paid for.
  const ins = await rest('POST', '/entitlements?on_conflict=payment_id', {
    user_id: userId, plan: price.plan, source: source || 'razorpay',
    starts_at: dates.starts_at, expires_at: dates.expires_at, payment_id: paymentId
  }, { Prefer: 'resolution=ignore-duplicates' });
  if (!ins.ok) return { retry: true };

  // Now mark the pending order row paid (or insert one if it's missing). If
  // this fails the customer still has access; the retry reconciles it.
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

  // Confirmation email is best-effort — never fail the webhook on it.
  try { await maybeSendEmail(price, dates.expires_at, pay); } catch (e) { /* ignore */ }
  return { duplicate: false };
}

// Fallback when our pending payments row is missing (it should never be, but a
// captured payment must not be stranded by our own bookkeeping). The ORDER's
// notes and amount were set by create-order.js server-side, so Razorpay's copy
// of them is as trustworthy as our row. Returns {retry} if Razorpay itself is
// unreachable, so the event is redelivered rather than silently dropped.
async function orderFromRazorpay(orderId) {
  const KEY = process.env.RAZORPAY_KEY_ID, SEC = process.env.RAZORPAY_KEY_SECRET;
  if (!KEY || !SEC) return { retry: true };
  let r;
  try {
    r = await fetch('https://api.razorpay.com/v1/orders/' + encodeURIComponent(orderId), {
      headers: { Authorization: 'Basic ' + Buffer.from(KEY + ':' + SEC).toString('base64') }
    });
  } catch (e) { return { retry: true }; }
  if (r.status === 400 || r.status === 404) return { missing: true };  // not an order of ours
  if (!r.ok) return { retry: true };
  let o; try { o = await r.json(); } catch (e) { return { retry: true }; }
  const notes = (o && o.notes) || {};
  const price = PRICES[notes.plan_key];
  if (!price || !notes.user_id) return { missing: true };
  return { user_id: notes.user_id, plan: price.plan, period: price.period, amount_paise: o.amount };
}

// Money going back to the buyer → the access it bought ends now.
//
// Deliberately NOT here: payment.dispute.created (a chargeback that has only
// been opened, not decided — revoking then would punish the customer for a
// dispute the seller may win) and refund.failed. Only settled outcomes revoke.
const REFUND_EVENTS = {
  'refund.created': 1, 'refund.processed': 1, 'payment.dispute.lost': 1
};
function refundedPaymentId(evt) {
  const p = evt && evt.payload;
  if (!p) return null;
  if (p.refund && p.refund.entity && p.refund.entity.payment_id) return p.refund.entity.payment_id;
  if (p.dispute && p.dispute.entity && p.dispute.entity.payment_id) return p.dispute.entity.payment_id;
  if (p.payment && p.payment.entity && p.payment.entity.id) return p.payment.entity.id;
  return null;
}
// A partial refund (goodwill ₹100 off a ₹2,499 year) must not delete the year.
// Only a refund covering the whole captured amount revokes.
//
// `paidFallback` is the amount from OUR payments row, used when the event
// carries the refund but not the original payment entity — without it we
// could not tell partial from full and would under-revoke, which is a leak.
// Returns null when neither source knows the amounts (caller decides).
function isFullRefund(evt, paidFallback) {
  if (evt && evt.event === 'payment.dispute.lost') return true;   // the whole payment is gone
  const p = (evt && evt.payload) || {};
  const pay = p.payment && p.payment.entity;
  const ref = p.refund && p.refund.entity;
  const paid = (pay && Number(pay.amount)) || (paidFallback != null ? Number(paidFallback) : null);
  const back = (pay && pay.amount_refunded != null) ? Number(pay.amount_refunded)
             : (ref && ref.amount != null ? Number(ref.amount) : null);
  if (!paid || !isFinite(paid)) return null;                      // amount unknown
  if (back == null || !isFinite(back)) return null;
  return back >= paid;
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
      if (!pay || !pay.id) return res.status(200).json({ ok: true, ignored: true });

      // Plan + beneficiary come from OUR subscriptions row, never from notes.
      const ourSubRes = await rest('GET', '/subscriptions?select=user_id,plan,period,plan_key&rzp_subscription_id=eq.'
        + encodeURIComponent(sub.id) + '&limit=1');
      if (!ourSubRes.ok) return res.status(503).json({ error: 'lookup_failed' });
      const ourSub = ((await ourSubRes.json()) || [])[0];
      if (!ourSub || !ourSub.user_id) return res.status(200).json({ ok: true, ignored: 'unknown_subscription' });

      const price = PRICES[ourSub.plan_key] || priceFor(ourSub.plan, ourSub.period);
      if (!price) return res.status(200).json({ ok: true, ignored: 'unknown_plan' });
      // No equality check against today's price here, on purpose. The charge
      // comes from a Razorpay Plan we created, so the amount is not something
      // a caller can choose; demanding it match the CURRENT price list would
      // cut off every existing subscriber the day we change a price. A zero or
      // negative charge is still nonsense and grants nothing.
      if (!currencyOk(pay) || !(Number(pay.amount) > 0)) {
        return res.status(200).json({ ok: true, ignored: 'amount_invalid' });
      }

      const r = await recordPaidAndEntitle({
        paymentId: pay.id, orderId: pay.order_id || null, userId: ourSub.user_id, price,
        amountPaise: pay.amount, evt, pay, source: 'razorpay_sub'
      });
      if (r.retry) return res.status(503).json({ error: 'retry' });
      if (!r.duplicate && planRank(price.plan) > 1) {
        try { await cancelLowerSubs(ourSub.user_id, price.plan); } catch (e) { /* best-effort */ }
      }
      return res.status(200).json({ ok: true, duplicate: !!r.duplicate });
    }

    // ---- money going back out: refunds and lost disputes revoke access ----
    if (REFUND_EVENTS[evt.event]) {
      const pid = refundedPaymentId(evt);
      if (!pid) return res.status(200).json({ ok: true, ignored: true });
      const enc = encodeURIComponent(pid);

      // What did we actually capture for this payment? Needed to tell a
      // partial refund from a full one when the event omits the payment entity.
      let paidFallback = null;
      const ourPayRes = await rest('GET', '/payments?select=amount_paise&razorpay_payment_id=eq.' + enc + '&limit=1');
      if (!ourPayRes.ok) return res.status(503).json({ error: 'lookup_failed' });
      const ourPay = ((await ourPayRes.json()) || [])[0];
      if (ourPay && ourPay.amount_paise != null) paidFallback = ourPay.amount_paise;

      const full = isFullRefund(evt, paidFallback);
      // Unknown amounts: revoke. Leaving paid-for-then-refunded access live is
      // the worse error, and the owner can re-grant from the admin panel.
      if (full === false) return res.status(200).json({ ok: true, ignored: 'partial_refund' });
      const nowIso = new Date().toISOString();
      // Expire the entitlement this payment bought (only if still live).
      const e1 = await rest('PATCH', '/entitlements?payment_id=eq.' + enc
        + '&or=(expires_at.gt.' + encodeURIComponent(nowIso) + ',expires_at.is.null)', { expires_at: nowIso });
      const e2 = await rest('PATCH', '/payments?razorpay_payment_id=eq.' + enc, { status: 'refunded' });
      // The refund can arrive before the capture was recorded, in which case
      // razorpay_payment_id is still null on our row. Stamp the ORDER too, so
      // a later capture retry sees 'refunded' and grants nothing.
      const oid = (evt.payload && evt.payload.payment && evt.payload.payment.entity
        && evt.payload.payment.entity.order_id) || null;
      let e3 = { ok: true };
      if (oid) {
        e3 = await rest('PATCH', '/payments?razorpay_order_id=eq.' + encodeURIComponent(oid),
          { razorpay_payment_id: pid, status: 'refunded' });
      }
      // Reporting a revocation we did not perform would leave paid-for-then-
      // refunded access live with nothing to notice it by; 503 gets a retry.
      if (!e1.ok || !e2.ok || !e3.ok) return res.status(503).json({ error: 'revoke_failed' });
      return res.status(200).json({ ok: true, revoked: true });
    }

    // ---- one-time payments (and the payment.captured echo of sub charges,
    //      which dedupes inside recordPaidAndEntitle) ----
    if (evt.event !== 'payment.captured') return res.status(200).json({ ok: true, ignored: true });

    const pay = evt.payload && evt.payload.payment && evt.payload.payment.entity;
    if (!pay || !pay.id) return res.status(200).json({ ok: true, ignored: true });

    // A payment we did not raise an order for buys nothing: `notes` on the
    // payment are attacker-controllable, our payments row is not.
    const orderId = pay.order_id;
    if (!orderId) return res.status(200).json({ ok: true, ignored: 'no_order' });

    const ordRes = await rest('GET', '/payments?select=user_id,plan,period,amount_paise&razorpay_order_id=eq.'
      + encodeURIComponent(orderId) + '&limit=1');
    if (!ordRes.ok) return res.status(503).json({ error: 'lookup_failed' });
    let ord = ((await ordRes.json()) || [])[0];

    // No row of ours? Ask Razorpay for the order itself before giving up —
    // its notes and amount are the ones create-order.js set server-side, so a
    // lost pending row can't turn a real payment into no access.
    if (!ord || !ord.user_id) {
      const fb = await orderFromRazorpay(orderId);
      if (fb.retry) return res.status(503).json({ error: 'lookup_failed' });
      if (fb.missing) return res.status(200).json({ ok: true, ignored: 'unknown_order' });
      ord = fb;
    }

    const price = priceFor(ord.plan, ord.period);
    if (!price) return res.status(200).json({ ok: true, ignored: 'unknown_plan' });
    // Authority is the amount WE asked for on this order, not today's price
    // list — otherwise a price change strands every in-flight checkout.
    if (Number(pay.amount) !== Number(ord.amount_paise) || !currencyOk(pay)) {
      return res.status(200).json({ ok: true, ignored: 'amount_mismatch' });
    }

    const r = await recordPaidAndEntitle({
      paymentId: pay.id, orderId, userId: ord.user_id, price, amountPaise: pay.amount, evt, pay,
      source: pay.invoice_id ? 'razorpay_sub' : 'razorpay'
    });
    if (r.retry) return res.status(503).json({ error: 'retry' });
    if (r.refunded) return res.status(200).json({ ok: true, ignored: 'already_refunded' });
    if (!r.duplicate && planRank(price.plan) > 1) {
      try { await cancelLowerSubs(ord.user_id, price.plan); } catch (e) { /* best-effort */ }
    }
    return res.status(200).json({ ok: true, duplicate: !!r.duplicate });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
module.exports.verifySignature = verifySignature;
module.exports.computeDates = computeDates;
module.exports.perDayPaiseOf = perDayPaiseOf;
module.exports.cancelLowerSubs = cancelLowerSubs;
module.exports.SUB_STATUS = SUB_STATUS;
module.exports.priceFor = priceFor;
module.exports.amountOk = amountOk;
module.exports.REFUND_EVENTS = REFUND_EVENTS;
module.exports.refundedPaymentId = refundedPaymentId;
