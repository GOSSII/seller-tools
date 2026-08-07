// Vercel serverless function — scheduled data retention purge.
//
// Called by Vercel Cron (see vercel.json). Replaces the old "delete something
// if Math.random() < 0.05 on an incoming request" approach, which never ran
// when traffic was quiet and could not keep up when it was not.
//
// Retention, matching what privacy.html tells users:
//   presence       2 days   — the admin panel only ever reads a 24h window
//   client_errors  30 days  — long enough to spot a regression
//   login_events   180 days — security/audit history, then it goes
//
// Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when that env
// var is set. If CRON_SECRET is unset the endpoint refuses to run at all
// rather than becoming an open delete button.
const { rest, bearer } = require('./_lib/supa');

const DAYS = { presence: 2, client_errors: 30, login_events: 180 };
const COL = { presence: 'last_seen_at', client_errors: 'at', login_events: 'at' };

function cutoffIso(days, nowMs) {
  return new Date((nowMs == null ? Date.now() : nowMs) - days * 86400000).toISOString();
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const secret = process.env.CRON_SECRET || '';
    if (!secret) return res.status(503).json({ error: 'cron_secret_unset' });
    if (bearer(req) !== secret) return res.status(401).json({ error: 'auth_required' });
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'server_misconfigured' });
    }

    const now = Date.now();
    const done = {};
    for (const table of Object.keys(DAYS)) {
      const iso = cutoffIso(DAYS[table], now);
      try {
        const r = await rest('DELETE', '/' + table + '?' + COL[table] + '=lt.' + encodeURIComponent(iso));
        done[table] = r.ok ? 'purged' : 'skipped';
      } catch (e) { done[table] = 'error'; }
    }
    return res.status(200).json({ ok: true, done });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};

module.exports.cutoffIso = cutoffIso;
module.exports.DAYS = DAYS;
