// Vercel serverless function — anonymous presence heartbeat.
// The client sends {sid, route} every minute while the tab is open; we track
// per-tab sessions so the admin panel can show who's online now and how long
// sessions last. Privacy: sid is a random per-tab id, no IP or user-agent is
// stored; user_id only when the caller sends a valid login token.
const { userFromToken, rest, bearer } = require('./_lib/supa');
const { allow } = require('./_lib/ratelimit');

function safeJson(s) { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch (e) { return null; } }
const SID_RE = /^[a-zA-Z0-9-]{8,64}$/;
// The client heartbeats once a minute per tab. This leaves room for a dozen
// tabs behind one NAT while stopping a script from minting presence rows (and
// GoTrue lookups) at will.
const RL_MAX = 60, RL_WINDOW_MS = 60 * 1000;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    // Silent no-op when throttled: presence is best-effort telemetry.
    if (!allow(req, RL_MAX, RL_WINDOW_MS)) return res.status(200).json({ ok: false });
    const body = safeJson(req.body) || {};
    const sid = String(body.sid || '');
    let route = String(body.route || '').slice(0, 64);
    if (!SID_RE.test(sid)) return res.status(400).json({ error: 'bad_sid' });

    let userId = null;
    const token = bearer(req);
    if (token) { try { const u = await userFromToken(token); if (u) userId = u.id; } catch (e) { /* anonymous */ } }

    const nowIso = new Date().toISOString();
    // user_id always reflects the CURRENT login state of the tab: a logout
    // must clear the attribution on the next heartbeat, not keep showing the
    // old account as online.
    const patchBody = { last_seen_at: nowIso, route, user_id: userId };
    const up = await rest('PATCH', '/presence?sid=eq.' + encodeURIComponent(sid),
      patchBody, { Prefer: 'return=representation' });
    let updated = false;
    if (up.ok) { const r = await up.json().catch(() => []); updated = Array.isArray(r) && r.length > 0; }
    if (!updated) {
      await rest('POST', '/presence', { sid, user_id: userId, route, started_at: nowIso, last_seen_at: nowIso });
    }

    // Retention is handled by the scheduled purge in api/cleanup.js.

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
