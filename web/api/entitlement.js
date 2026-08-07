// Vercel serverless function — resolves the caller's current plan, and
// enforces the one-active-session rule (Phase 5).
//
// Flow: verify the Supabase JWT (→ user), then:
//  - if an X-Session-Id header is sent and the profile has a DIFFERENT active
//    session, answer 409 {error:"session_taken"} (this browser was kicked);
//  - otherwise read the newest non-expired entitlement with the service role
//    (bypasses RLS) and answer {plan, expires_at}.
// Anything unauthenticated/invalid/errored resolves to {plan:"free"}.
//
// Env (server only): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
const { userFromToken, rest, bearer } = require('./_lib/supa');

const FREE = { plan: 'free', expires_at: null };

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const token = bearer(req);
    if (!token) return res.status(200).json(FREE);
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'server_misconfigured' });
    }

    const user = await userFromToken(token);
    if (!user) return res.status(200).json(FREE);

    // One-active-session check (only when the client supplies its session id).
    const sid = (req.headers['x-session-id'] || req.headers['X-Session-Id'] || '').toString();
    if (sid) {
      const pr = await rest('GET', '/profiles?select=active_session_id&id=eq.' + encodeURIComponent(user.id) + '&limit=1');
      if (pr.ok) {
        const rows = await pr.json();
        const active = rows && rows[0] && rows[0].active_session_id;
        if (active && active !== sid) return res.status(409).json({ error: 'session_taken' });
      }
    }

    const er = await rest('GET', '/entitlements?select=plan,starts_at,expires_at,created_at&user_id=eq.'
      + encodeURIComponent(user.id) + '&order=created_at.desc&limit=10');
    if (!er.ok) return res.status(200).json(FREE);
    const rows = await er.json();

    const now = Date.now();
    // Highest live plan wins: a user holding both a live Pro and a live
    // Starter row is Pro, regardless of which row was created last.
    const liveRows = (Array.isArray(rows) ? rows : []).filter(
      r => (r.plan === 'starter' || r.plan === 'pro')
        && (!r.expires_at || new Date(r.expires_at).getTime() > now)
    );
    const live = liveRows.find(r => r.plan === 'pro') || liveRows[0];
    if (live) {
      return res.status(200).json({ plan: live.plan, expires_at: live.expires_at || null });
    }
    return res.status(200).json(FREE);
  } catch (e) {
    return res.status(200).json(FREE);
  }
};
