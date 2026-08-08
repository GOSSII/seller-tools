// Vercel serverless function — creates a Razorpay order for a plan.
// Auth required (Supabase JWT). The amount is ALWAYS taken from the
// server-side price list; a client-supplied amount is never trusted.
// Returns { order_id, key_id, amount, currency, plan, period, label, email }.
const { PRICES } = require('./_lib/prices');
const { userFromToken, rest, bearer } = require('./_lib/supa');

function safeJson(s) { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch (e) { return null; } }

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

    const token = bearer(req);
    if (!token) return res.status(401).json({ error: 'auth_required' });

    const KEY = process.env.RAZORPAY_KEY_ID, SEC = process.env.RAZORPAY_KEY_SECRET;
    if (!KEY || !SEC) return res.status(500).json({ error: 'server_misconfigured' });

    const body = safeJson(req.body) || {};
    const price = PRICES[body.plan];
    if (!price) return res.status(400).json({ error: 'bad_plan' });

    const user = await userFromToken(token);
    if (!user) return res.status(401).json({ error: 'auth_required' });

    // Create the Razorpay order (amount comes from the server list only).
    const receipt = ('r_' + user.id + '_' + Date.now()).slice(0, 40);
    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(KEY + ':' + SEC).toString('base64')
      },
      body: JSON.stringify({
        amount: price.amount_paise,
        currency: 'INR',
        receipt,
        notes: { user_id: user.id, plan_key: body.plan }
      })
    });
    if (!orderRes.ok) {
      const t = await orderRes.text().catch(() => '');
      return res.status(502).json({ error: 'razorpay_error', detail: String(t).slice(0, 200) });
    }
    const order = await orderRes.json();

    // Record the pending payment row. This is NOT best-effort any more: the
    // webhook resolves the plan, amount and buyer from this row, so a checkout
    // that proceeds without it can take money we then cannot attribute.
    // Failing here costs a retry; failing silently costs a paid customer.
    let recorded = false;
    try {
      const pr = await rest('POST', '/payments', {
        user_id: user.id, razorpay_order_id: order.id,
        amount_paise: price.amount_paise, plan: price.plan, period: price.period, status: 'pending'
      });
      recorded = pr.ok;
    } catch (e) { recorded = false; }
    if (!recorded) return res.status(503).json({ error: 'try_again' });

    return res.status(200).json({
      order_id: order.id, key_id: KEY, amount: price.amount_paise, currency: 'INR',
      plan: price.plan, period: price.period, label: price.label, email: user.email || ''
    });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
