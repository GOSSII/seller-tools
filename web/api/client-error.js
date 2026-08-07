// Vercel serverless function — production JS error intake (Phase 8).
// The page reports {message, route, source, line, col} when its own code
// throws; the hidden admin panel lists them. Deliberately anonymous: no user
// id, no IP, no user-agent — the point is fixing the code, not tracking the
// visitor. The client rate-limits itself; this end truncates and inserts.
const { rest } = require('./_lib/supa');
const { allow } = require('./_lib/ratelimit');

function safeJson(s) { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch (e) { return null; } }
const cut = (v, n) => String(v == null ? '' : v).slice(0, n);
const clampInt = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(2147483647, Math.trunc(n)));
};
// A real page throws a handful of times at most; the client already caps
// itself at 5. Anything past this is a flood trying to bury real errors.
const RL_MAX = 20, RL_WINDOW_MS = 10 * 60 * 1000;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    // Fire-and-forget by design: a throttled report is a silent no-op.
    if (!allow(req, RL_MAX, RL_WINDOW_MS)) return res.status(200).json({ ok: false });
    const b = safeJson(req.body) || {};
    const message = cut(b.message, 300).trim();
    if (!message) return res.status(400).json({ error: 'no_message' });
    const row = {
      message,
      route: cut(b.route, 64),
      source: cut(b.source, 200),
      // Clamp to int4 — a finite but oversized value (1e30) fails the insert.
      line: clampInt(b.line),
      col: clampInt(b.col)
    };
    const r = await rest('POST', '/client_errors', row);
    // Table missing (schema.sql not re-run yet) must not surface as an error
    // to the visitor — this endpoint is fire-and-forget by design.
    if (!r.ok) return res.status(200).json({ ok: false });

    // Retention is handled by the scheduled purge in api/cleanup.js.
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: false });
  }
};
