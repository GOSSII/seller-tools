// Vercel serverless function — anonymous presence heartbeat.
// The client sends {sid, route} every minute while the tab is open; we track
// per-tab sessions so the admin panel can show who's online now and how long
// sessions last. Privacy: sid is a random per-tab id, no IP or user-agent is
// stored; user_id only when the caller sends a valid login token.
//
// Visitor counts ride on the same request. The browser remembers the last
// (IST) day it was counted and, on its first ping of a new day, adds
// visit:{d:1, m, f} — m=1 if it is also the first visit this month, f=1 if the
// browser has never been counted before. Those flags only ever increment the
// day's totals in visits_daily; nothing that could tell two visitors apart is
// sent or kept. The reply says `counted` so the browser marks the day done
// only once the count has actually landed.
const { userFromToken, rest, bearer } = require('./_lib/supa');
const { allow } = require('./_lib/ratelimit');

function safeJson(s) { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch (e) { return null; } }
const SID_RE = /^[a-zA-Z0-9-]{8,64}$/;
// The client heartbeats once a minute per tab. This leaves room for a dozen
// tabs behind one NAT while stopping a script from minting presence rows (and
// GoTrue lookups) at will.
const RL_MAX = 60, RL_WINDOW_MS = 60 * 1000;

// ---- pure, unit-tested helpers --------------------------------------------
const IST_OFFSET_MS = 5.5 * 3600000;
function istDay(nowMs) { return new Date(nowMs + IST_OFFSET_MS).toISOString().slice(0, 10); }
// Search-engine renderers, Lighthouse and headless test browsers run our JS and
// would ping like anyone else. They are not visitors. A real browser always
// sends a user-agent, so an empty one is treated the same way.
// `page\s?speed` rather than `pagespeed`: PageSpeed Insights identifies itself
// as "Google Page Speed Insights", with spaces, so the un-spaced spelling never
// matched the one tool it was written for and every PSI run counted as a visit.
const BOT_UA_RE = /bot|crawl|spider|slurp|headless|lighthouse|page\s?speed|prerender|playwright|puppeteer/i;
function isBotUa(ua) { return !ua || BOT_UA_RE.test(String(ua)); }
// What this ping adds to today's row, or null for nothing. The flags nest — a
// browser's first visit ever is also its first this month and today — so a
// client sending f without d counts nothing, and f implies m.
function visitIncrements(visit, newSession) {
  const v = visit && typeof visit === 'object' && visit.d === 1 ? 1 : 0;
  const f = v && visit.f === 1 ? 1 : 0;
  const m = v && (visit.m === 1 || f) ? 1 : 0;
  const s = newSession ? 1 : 0;
  return (v || s) ? { v, m, f, s } : null;
}

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
    let updated = false, newSession = false;
    if (up.ok) { const r = await up.json().catch(() => []); updated = Array.isArray(r) && r.length > 0; }
    if (!updated) {
      const ins = await rest('POST', '/presence', { sid, user_id: userId, route, started_at: nowIso, last_seen_at: nowIso });
      newSession = ins.ok;
    }

    // Retention is handled by the scheduled purge in api/cleanup.js.

    let counted = false;
    const inc = visitIncrements(body.visit, newSession);
    if (inc && isBotUa(req.headers['user-agent'])) {
      // Not a visitor. Say "counted" so a crawler that keeps its storage stops asking.
      counted = inc.v === 1;
    } else if (inc) {
      // The owner checking their own panel is not a visitor either. Only looked
      // up when there is something to count AND a login — once a day per browser.
      let admin = false;
      if (userId) {
        const pr = await rest('GET', '/profiles?select=is_admin&id=eq.' + encodeURIComponent(userId) + '&limit=1').catch(() => null);
        admin = !!(pr && pr.ok && (((await pr.json().catch(() => [])) || [])[0] || {}).is_admin);
      }
      if (admin) counted = inc.v === 1;
      else {
        const r = await rest('POST', '/rpc/visit_add', { d: istDay(Date.now()), v: inc.v, m: inc.m, f: inc.f, s: inc.s }).catch(() => null);
        // visits_daily missing (schema.sql not re-run yet) → not counted, so
        // the browser keeps its flag and is counted once the table exists.
        counted = !!(r && r.ok) && inc.v === 1;
      }
    }

    return res.status(200).json({ ok: true, counted });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};

module.exports.istDay = istDay;
module.exports.isBotUa = isBotUa;
module.exports.visitIncrements = visitIncrements;
