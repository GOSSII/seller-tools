// Vercel serverless function — resolves the caller's current plan.
//
// Flow: verify the Supabase JWT from the Authorization header (by asking
// Supabase who it belongs to), then read that user's newest non-expired
// entitlement using the service_role key (which bypasses RLS). The browser
// can never mint a plan for itself — this is server-authoritative.
//
// Always answers 200 with {plan, expires_at}; anything unauthenticated,
// invalid or errored resolves to the safe default {plan:"free"}.
//
// Env (server only, set in Vercel): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const FREE = { plan: 'free', expires_at: null };

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const auth = req.headers.authorization || req.headers.Authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return res.status(200).json(FREE);

    const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!base || !service) return res.status(500).json({ error: 'server_misconfigured' });

    // 1) Validate the token and get the user it belongs to.
    const ur = await fetch(base + '/auth/v1/user', {
      headers: { apikey: service, Authorization: 'Bearer ' + token }
    });
    if (!ur.ok) return res.status(200).json(FREE);
    const user = await ur.json();
    if (!user || !user.id) return res.status(200).json(FREE);

    // 2) Read this user's entitlements with the service role (bypasses RLS).
    const q = base + '/rest/v1/entitlements'
      + '?select=plan,starts_at,expires_at,created_at'
      + '&user_id=eq.' + encodeURIComponent(user.id)
      + '&order=created_at.desc&limit=10';
    const er = await fetch(q, {
      headers: { apikey: service, Authorization: 'Bearer ' + service }
    });
    if (!er.ok) return res.status(200).json(FREE);
    const rows = await er.json();

    const now = Date.now();
    const live = (Array.isArray(rows) ? rows : []).find(
      r => !r.expires_at || new Date(r.expires_at).getTime() > now
    );
    if (live && (live.plan === 'starter' || live.plan === 'pro')) {
      return res.status(200).json({ plan: live.plan, expires_at: live.expires_at || null });
    }
    return res.status(200).json(FREE);
  } catch (e) {
    return res.status(200).json(FREE);
  }
};
