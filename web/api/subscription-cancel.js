// Vercel serverless function — cancels the user's auto-renewal at the end of
// the current paid cycle (cancel_at_cycle_end), never immediately: the user
// always keeps the access they already paid for.
//
// Auth required (Supabase JWT). Only the caller's own newest cancellable
// subscription is touched.
const { userFromToken, rest, bearer } = require('./_lib/supa');

const CANCELLABLE = ['created', 'authenticated', 'active', 'pending'];

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

    const token = bearer(req);
    if (!token) return res.status(401).json({ error: 'auth_required' });

    const KEY = process.env.RAZORPAY_KEY_ID, SEC = process.env.RAZORPAY_KEY_SECRET;
    if (!KEY || !SEC) return res.status(500).json({ error: 'server_misconfigured' });

    const user = await userFromToken(token);
    if (!user) return res.status(401).json({ error: 'auth_required' });

    const subRes = await rest('GET', '/subscriptions?select=id,rzp_subscription_id,status&user_id=eq.'
      + encodeURIComponent(user.id) + '&order=created_at.desc&limit=10');
    if (!subRes.ok) return res.status(500).json({ error: 'server_error' });
    const rows = await subRes.json();
    const sub = (rows || []).find(r => CANCELLABLE.includes(r.status) && r.rzp_subscription_id);
    if (!sub) return res.status(404).json({ error: 'no_active_subscription' });

    const cRes = await fetch('https://api.razorpay.com/v1/subscriptions/'
      + encodeURIComponent(sub.rzp_subscription_id) + '/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(KEY + ':' + SEC).toString('base64')
      },
      body: JSON.stringify({ cancel_at_cycle_end: 1 })
    });
    if (!cRes.ok) {
      const t = await cRes.text().catch(() => '');
      return res.status(502).json({ error: 'razorpay_error', detail: String(t).slice(0, 200) });
    }

    await rest('PATCH', '/subscriptions?id=eq.' + encodeURIComponent(sub.id),
      { status: 'cancel_requested' });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
