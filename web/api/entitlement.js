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

    // One-active-session check. This runs whether or not the caller supplies
    // the header: omitting X-Session-Id used to skip the comparison entirely,
    // which handed the paid plan to any number of parallel sessions on one
    // account. Once a session is claimed, only that session id is served.
    // (A browser that lost its stored id gets 409 and re-claims with one
    // click via the "Signed out here → Use here instead" panel.)
    const sid = (req.headers['x-session-id'] || req.headers['X-Session-Id'] || '').toString();
    const pr = await rest('GET', '/profiles?select=active_session_id&id=eq.' + encodeURIComponent(user.id) + '&limit=1');
    if (pr.ok) {
      const rows = await pr.json();
      const active = rows && rows[0] && rows[0].active_session_id;
      if (active && active !== sid) return res.status(409).json({ error: 'session_taken' });
    }

    // Ordered by expiry so the longest-dated rows are inside the window (a
    // user with many renewals must not have a live long grant fall off the end).
    const er = await rest('GET', '/entitlements?select=plan,starts_at,expires_at,created_at&user_id=eq.'
      + encodeURIComponent(user.id) + '&order=expires_at.desc.nullsfirst&limit=100');
    if (!er.ok) return res.status(200).json(FREE);
    const rows = await er.json();

    const now = Date.now();
    // A row counts only once it has started and before it expires.
    const liveRows = (Array.isArray(rows) ? rows : []).filter(
      r => (r.plan === 'starter' || r.plan === 'pro')
        && (!r.expires_at || new Date(r.expires_at).getTime() > now)
        && (!r.starts_at || new Date(r.starts_at).getTime() <= now)
    );
    // Highest live plan wins (pro > starter), and within it the furthest
    // expiry — so a short top-up never shortens the date we report.
    const pool = liveRows.some(r => r.plan === 'pro')
      ? liveRows.filter(r => r.plan === 'pro') : liveRows;
    const live = pool.reduce((best, r) => {
      if (!best) return r;
      if (!best.expires_at || !r.expires_at) return best.expires_at ? r : best; // null = perpetual
      return new Date(r.expires_at) > new Date(best.expires_at) ? r : best;
    }, null);
    if (live) {
      return res.status(200).json({ plan: live.plan, expires_at: live.expires_at || null });
    }
    return res.status(200).json(FREE);
  } catch (e) {
    return res.status(200).json(FREE);
  }
};
