// Vercel serverless function — public tool counters ("N labels cropped so
// far"). Unauthenticated by design: the Label Cropper needs no login, so its
// counter can't either.
//
// Privacy: the client sends ONE integer — how many labels a finished run
// produced. Never the file, never its contents, never anything derived from
// them. Disclosed in privacy.html alongside the presence heartbeat.
//
// Abuse: rate-limited per IP like the other unauthenticated writes, the
// increment is capped per request, and the counter is social proof rather
// than accounting — the worst a determined abuser achieves is a bigger
// number, which the honest floor in the UI already makes unremarkable.
const { rest } = require('./_lib/supa');
const { allow } = require('./_lib/ratelimit');

const TOOLS = { 'label-cropper': 'label_cropper' };
const MAX_PER_REQUEST = 1000;   // the tool itself tops out well below this per run

function safeJson(s) { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch (e) { return null; } }

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      let tool = (req.query && req.query.tool) || '';
      if (!tool) { try { tool = new URL(req.url, 'http://x').searchParams.get('tool') || ''; } catch (e) {} }
      const key = TOOLS[String(tool)];
      if (!key) return res.status(400).json({ error: 'bad_tool' });
      const r = await rest('GET', '/counters?select=value&key=eq.' + encodeURIComponent(key) + '&limit=1');
      if (!r.ok) return res.status(503).json({ error: 'unavailable' });
      const row = ((await r.json()) || [])[0];
      return res.status(200).json({ value: row ? Number(row.value) : 0 });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    if (!allow(req, 12, 60000)) return res.status(429).json({ error: 'slow_down' });

    const body = safeJson(req.body) || {};
    const key = TOOLS[String(body.tool || '')];
    const n = Math.floor(Number(body.n));
    if (!key || !isFinite(n) || n < 1 || n > MAX_PER_REQUEST) return res.status(400).json({ error: 'bad_request' });

    const r = await rest('POST', '/rpc/counter_add', { k: key, n });
    if (!r.ok) return res.status(503).json({ error: 'unavailable' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
