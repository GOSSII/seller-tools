// Vercel serverless function — production JS error intake (Phase 8).
// The page reports {message, route, source, line, col} when its own code
// throws; the hidden admin panel lists them. Deliberately anonymous: no user
// id, no IP, no user-agent — the point is fixing the code, not tracking the
// visitor. The client rate-limits itself; this end truncates and inserts.
const { rest } = require('./_lib/supa');

function safeJson(s) { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch (e) { return null; } }
const cut = (v, n) => String(v == null ? '' : v).slice(0, n);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    const b = safeJson(req.body) || {};
    const message = cut(b.message, 300).trim();
    if (!message) return res.status(400).json({ error: 'no_message' });
    const row = {
      message,
      route: cut(b.route, 64),
      source: cut(b.source, 200),
      line: Number.isFinite(Number(b.line)) ? Number(b.line) : null,
      col: Number.isFinite(Number(b.col)) ? Number(b.col) : null
    };
    const r = await rest('POST', '/client_errors', row);
    // Table missing (schema.sql not re-run yet) must not surface as an error
    // to the visitor — this endpoint is fire-and-forget by design.
    if (!r.ok) return res.status(200).json({ ok: false });

    // Best-effort cleanup of month-old rows.
    if (Math.random() < 0.05) {
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      try { await rest('DELETE', '/client_errors?at=lt.' + encodeURIComponent(cutoff)); } catch (e) { /* ignore */ }
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: false });
  }
};
