// Vercel serverless function — claims the single active session for a user and
// records login/device history (Phase 5). Auth required.
//
// Body: { device_hash, action? }
//   - default: claim. Generates a new session_id, writes it to
//     profiles.active_session_id, appends a login_events row, and upserts the
//     device. If claiming would exceed profiles.device_limit distinct devices,
//     responds 403 {error:"device_limit"} and does NOT claim.
//   - action:"logout_all": clears profiles.active_session_id (every other
//     session then fails its next entitlement check) and logs the event.
//
// All of this is disclosed in web/privacy.html §1–§2 (DPDP Act).
// Env (server only): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
const crypto = require('crypto');
const { userFromToken, rest, bearer } = require('./_lib/supa');

// --- pure, unit-tested helpers ---------------------------------------------
function deviceLabelFromUA(ua) {
  ua = String(ua || '');
  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  let os = 'device';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return browser + ' on ' + os;
}

// Decide whether a claim is allowed and whether it kicks a previous session.
// knownHashes: array of the user's existing device_hash values.
function evaluateClaim(activeSessionId, knownHashes, incomingHash, deviceLimit) {
  const known = new Set(knownHashes || []);
  const isNewDevice = !known.has(incomingHash);
  const distinctAfter = isNewDevice ? known.size + 1 : known.size;
  const overLimit = isNewDevice && distinctAfter > (deviceLimit || 3);
  return {
    isNewDevice,
    overLimit,
    kickedPrevious: !!activeSessionId // a prior active session is being superseded
  };
}

function clientIp(req) {
  const xf = (req.headers['x-forwarded-for'] || '').toString();
  if (xf) return xf.split(',')[0].trim();
  return (req.headers['x-real-ip'] || '').toString() || null;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    const token = bearer(req);
    if (!token) return res.status(401).json({ error: 'auth_required' });
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'server_misconfigured' });
    }
    const user = await userFromToken(token);
    if (!user) return res.status(401).json({ error: 'auth_required' });

    let body = {};
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch (e) { body = {}; }
    const ua = (req.headers['user-agent'] || '').toString();
    const ip = clientIp(req);

    // logout everywhere: clear the active session and log it.
    if (body.action === 'logout_all') {
      await rest('PATCH', '/profiles?id=eq.' + encodeURIComponent(user.id), { active_session_id: null });
      await rest('POST', '/login_events', {
        user_id: user.id, ip, user_agent: ua, device_hash: 'logout_all', kicked_previous: false
      });
      return res.status(200).json({ ok: true });
    }

    const deviceHash = String(body.device_hash || '').slice(0, 128);
    if (!deviceHash) return res.status(400).json({ error: 'device_hash_required' });

    // Read the profile (active session + device limit).
    const pr = await rest('GET', '/profiles?select=active_session_id,device_limit&id=eq.' + encodeURIComponent(user.id) + '&limit=1');
    const profile = pr.ok ? ((await pr.json())[0] || {}) : {};
    const deviceLimit = profile.device_limit || 3;

    // Read the user's known devices.
    const dr = await rest('GET', '/devices?select=device_hash&user_id=eq.' + encodeURIComponent(user.id));
    const knownHashes = dr.ok ? (await dr.json()).map(d => d.device_hash) : [];

    const decision = evaluateClaim(profile.active_session_id, knownHashes, deviceHash, deviceLimit);
    if (decision.overLimit) {
      return res.status(403).json({ error: 'device_limit', limit: deviceLimit });
    }

    // Upsert the device (merge on user_id+device_hash; keeps first_seen).
    const nowIso = new Date().toISOString();
    await rest('POST', '/devices?on_conflict=user_id,device_hash',
      { user_id: user.id, device_hash: deviceHash, label: deviceLabelFromUA(ua), last_seen: nowIso },
      { Prefer: 'resolution=merge-duplicates' });

    // Claim the session.
    const sessionId = crypto.randomUUID();
    await rest('PATCH', '/profiles?id=eq.' + encodeURIComponent(user.id), { active_session_id: sessionId });
    await rest('POST', '/login_events', {
      user_id: user.id, ip, user_agent: ua, device_hash: deviceHash, kicked_previous: decision.kickedPrevious
    });

    return res.status(200).json({ session_id: sessionId, kicked_previous: decision.kickedPrevious });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};

module.exports.deviceLabelFromUA = deviceLabelFromUA;
module.exports.evaluateClaim = evaluateClaim;
