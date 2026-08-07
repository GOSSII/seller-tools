// Per-IP token bucket for the two unauthenticated write endpoints
// (/api/ping, /api/client-error). Both insert rows with the service-role key,
// so without a limit anyone can grow the database and drown the admin panel's
// error feed and "online now" numbers in noise.
//
// State lives in the lambda instance's memory. That is deliberately modest:
// Vercel may run several instances, so the effective ceiling is
// (limit × instances), not `limit`. It costs nothing, needs no extra service,
// and turns "unbounded flood from one machine" into "a trickle" — which is the
// actual threat here. Swap in Upstash/Vercel KV if a real global limit is ever
// needed. Underscore-prefixed dir => not routed as a function.

const BUCKETS = new Map(); // ip -> { tokens, resetAt }
const MAX_KEYS = 5000;     // bound our own memory too

// The FIRST X-Forwarded-For entry is caller-supplied; take the trusted hop.
function ipOf(req) {
  const h = req.headers || {};
  const v = (h['x-vercel-forwarded-for'] || '').toString();
  if (v) return v.split(',').pop().trim();
  const xf = (h['x-forwarded-for'] || '').toString();
  if (xf) return xf.split(',').pop().trim();
  return (h['x-real-ip'] || '').toString() || 'unknown';
}

// Returns true when the request is allowed. `limit` requests per `windowMs`.
function allow(req, limit, windowMs, nowMs) {
  const now = nowMs == null ? Date.now() : nowMs;
  const ip = ipOf(req);
  let b = BUCKETS.get(ip);
  if (!b || now >= b.resetAt) {
    b = { tokens: limit, resetAt: now + windowMs };
    if (BUCKETS.size >= MAX_KEYS) {
      // Cheap eviction: drop everything already expired, else clear.
      for (const [k, v] of BUCKETS) if (now >= v.resetAt) BUCKETS.delete(k);
      if (BUCKETS.size >= MAX_KEYS) BUCKETS.clear();
    }
    BUCKETS.set(ip, b);
  }
  if (b.tokens <= 0) return false;
  b.tokens--;
  return true;
}

module.exports = { allow, ipOf, _buckets: BUCKETS };
