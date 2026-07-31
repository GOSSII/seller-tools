// Vercel serverless function — starts a Razorpay SUBSCRIPTION (auto-renew)
// for a plan. The one-time flow lives in create-order.js; this is the
// auto-renewal alternative the user can pick at checkout.
//
// Auth required (Supabase JWT). Amounts always come from the server-side
// price list. Razorpay Plan ids are created lazily via the API and cached in
// the rzp_plans table, keyed by plan_key + Razorpay key id so test-mode and
// live-mode ids never mix. Returns { subscription_id, key_id, ... } for
// Razorpay Checkout.
const { PRICES } = require('./_lib/prices');
const { userFromToken, rest, bearer } = require('./_lib/supa');

function safeJson(s) { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch (e) { return null; } }

function rzpHeaders(KEY, SEC) {
  return {
    'Content-Type': 'application/json',
    Authorization: 'Basic ' + Buffer.from(KEY + ':' + SEC).toString('base64')
  };
}

// Find (in our cache) or create (via the Razorpay API) the Plan id for a
// price key. Exported for unit tests.
async function getOrCreatePlanId(planKey, price, KEY, SEC) {
  const cacheKey = planKey + '|' + KEY;
  const cached = await rest('GET', '/rzp_plans?select=rzp_plan_id&key=eq.' + encodeURIComponent(cacheKey) + '&limit=1');
  if (cached.ok) {
    const rows = await cached.json();
    if (rows && rows[0] && rows[0].rzp_plan_id) return rows[0].rzp_plan_id;
  }
  const planRes = await fetch('https://api.razorpay.com/v1/plans', {
    method: 'POST',
    headers: rzpHeaders(KEY, SEC),
    body: JSON.stringify({
      period: price.period, interval: 1,
      item: { name: price.label + ' — auto-renew', amount: price.amount_paise, currency: 'INR' },
      notes: { plan_key: planKey }
    })
  });
  if (!planRes.ok) return null;
  const plan = await planRes.json();
  if (!plan || !plan.id) return null;
  try { await rest('POST', '/rzp_plans', { key: cacheKey, rzp_plan_id: plan.id }); } catch (e) { /* cache miss is fine */ }
  return plan.id;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

    // Razorpay only accepts recurring payments once Subscriptions is
    // activated on the account. The Plan/Subscription API calls below
    // succeed regardless, so without this gate Checkout is the first thing
    // to notice and shows the buyer "merchant is not supporting recurring
    // payment". Refusing here instead makes the client fall back to the
    // one-time order silently. Set SUBSCRIPTIONS_ENABLED=1 in Vercel once
    // Razorpay has approved Subscriptions on the account.
    if (!/^(1|true|yes)$/i.test(String(process.env.SUBSCRIPTIONS_ENABLED || ''))) {
      return res.status(503).json({ error: 'subscriptions_disabled' });
    }

    const token = bearer(req);
    if (!token) return res.status(401).json({ error: 'auth_required' });

    const KEY = process.env.RAZORPAY_KEY_ID, SEC = process.env.RAZORPAY_KEY_SECRET;
    if (!KEY || !SEC) return res.status(500).json({ error: 'server_misconfigured' });

    const body = safeJson(req.body) || {};
    const price = PRICES[body.plan];
    if (!price) return res.status(400).json({ error: 'bad_plan' });

    const user = await userFromToken(token);
    if (!user) return res.status(401).json({ error: 'auth_required' });

    const planId = await getOrCreatePlanId(body.plan, price, KEY, SEC);
    if (!planId) return res.status(502).json({ error: 'razorpay_error', detail: 'plan_create_failed' });

    const subRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: rzpHeaders(KEY, SEC),
      body: JSON.stringify({
        plan_id: planId,
        total_count: price.sub_total_count,
        quantity: 1,
        customer_notify: 1,
        notes: { user_id: user.id, plan_key: body.plan }
      })
    });
    if (!subRes.ok) {
      const t = await subRes.text().catch(() => '');
      return res.status(502).json({ error: 'razorpay_error', detail: String(t).slice(0, 200) });
    }
    const sub = await subRes.json();

    // Record the subscription (best-effort; webhook updates status later).
    try {
      await rest('POST', '/subscriptions', {
        user_id: user.id, rzp_subscription_id: sub.id,
        plan_key: body.plan, plan: price.plan, period: price.period, status: sub.status || 'created'
      });
    } catch (e) { /* ignore */ }

    return res.status(200).json({
      subscription_id: sub.id, key_id: KEY, amount: price.amount_paise, currency: 'INR',
      plan: price.plan, period: price.period, label: price.label, email: user.email || ''
    });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
module.exports.getOrCreatePlanId = getOrCreatePlanId;
