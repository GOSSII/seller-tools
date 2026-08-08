// Server-side Supabase helpers shared by the api/* functions. All calls use
// the service_role key (bypasses RLS) and read env lazily so this module can
// be required in unit tests without any env set.
function base() { return (process.env.SUPABASE_URL || '').replace(/\/$/, ''); }
function service() { return process.env.SUPABASE_SERVICE_ROLE_KEY || ''; }

// Validate a user JWT and return the user, or null.
async function userFromToken(token) {
  if (!token) return null;
  const r = await fetch(base() + '/auth/v1/user', {
    headers: { apikey: service(), Authorization: 'Bearer ' + token }
  });
  if (!r.ok) return null;
  const u = await r.json();
  return (u && u.id) ? u : null;
}

// Thin PostgREST wrapper (service role). pathAndQuery starts with '/'.
async function rest(method, pathAndQuery, body, extraHeaders) {
  return fetch(base() + '/rest/v1' + pathAndQuery, {
    method,
    headers: Object.assign(
      { apikey: service(), Authorization: 'Bearer ' + service(), 'Content-Type': 'application/json' },
      extraHeaders || {}
    ),
    body: body ? JSON.stringify(body) : undefined
  });
}

// Bearer token from an incoming request's Authorization header.
function bearer(req) {
  const a = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  return a.startsWith('Bearer ') ? a.slice(7).trim() : '';
}

// GoTrue admin call (service role) — e.g. inviting a user by email.
// pathAndQuery starts with '/', relative to /auth/v1.
async function auth(method, pathAndQuery, body) {
  return fetch(base() + '/auth/v1' + pathAndQuery, {
    method,
    headers: {
      apikey: service(), Authorization: 'Bearer ' + service(), 'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

module.exports = { base, service, userFromToken, rest, bearer, auth };
