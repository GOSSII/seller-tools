// Vercel serverless function — owner admin panel (Phase 6). One action-based
// endpoint. EVERY action requires a valid JWT whose profile has is_admin=true,
// verified server-side (never trust the client). Data access uses the
// service_role key. Every action is audited into login_events.
//
// Actions (POST { action, ... }):
//   stats                                        → dashboard numbers + signups
//   list_users { q }                             → users (plan/expiry/devices/last login)
//   user_detail { user_id }                      → entitlements/payments/logins/devices
//   grant { user_id, plan, days }                → insert entitlement (source 'admin')
//   revoke { user_id }                           → expire active entitlements now
//   reset_devices { user_id }                    → delete devices + clear active session
//   set_device_limit { user_id, limit }          → update profiles.device_limit
const { userFromToken, rest, bearer } = require('./_lib/supa');

// ---- pure, unit-tested helpers --------------------------------------------
function grantDates(days, nowMs) {
  return {
    starts_at: new Date(nowMs).toISOString(),
    expires_at: new Date(nowMs + (days || 0) * 86400000).toISOString()
  };
}
function revenueThisMonthPaise(payments, nowMs) {
  const d = new Date(nowMs);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  return (payments || []).filter(p => p.status === 'paid' && p.created_at).reduce((sum, p) => {
    const t = new Date(p.created_at);
    return (t.getUTCFullYear() === y && t.getUTCMonth() === m) ? sum + (p.amount_paise || 0) : sum;
  }, 0);
}
function signupsByDay(profiles, nowMs, nDays) {
  const out = [];
  const start = new Date(nowMs); start.setUTCHours(0, 0, 0, 0);
  const counts = {};
  (profiles || []).forEach(p => { if (p.created_at) counts[p.created_at.slice(0, 10)] = (counts[p.created_at.slice(0, 10)] || 0) + 1; });
  for (let i = nDays - 1; i >= 0; i--) {
    const day = new Date(start.getTime() - i * 86400000).toISOString().slice(0, 10);
    out.push({ d: day, count: counts[day] || 0 });
  }
  return out;
}
function isActive(ent, nowMs) {
  return (ent.plan === 'starter' || ent.plan === 'pro') && (!ent.expires_at || new Date(ent.expires_at).getTime() > nowMs);
}

function clientIp(req) {
  const xf = (req.headers['x-forwarded-for'] || '').toString();
  return xf ? xf.split(',')[0].trim() : ((req.headers['x-real-ip'] || '').toString() || null);
}
async function jsonOf(r) { try { return await r.json(); } catch (e) { return null; } }

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'server_misconfigured' });
    }
    const token = bearer(req);
    if (!token) return res.status(401).json({ error: 'auth_required' });
    const user = await userFromToken(token);
    if (!user) return res.status(401).json({ error: 'auth_required' });

    // Admin check — server-authoritative.
    const pr = await rest('GET', '/profiles?select=is_admin&id=eq.' + encodeURIComponent(user.id) + '&limit=1');
    const prof = pr.ok ? ((await pr.json())[0] || {}) : {};
    if (!prof.is_admin) return res.status(403).json({ error: 'forbidden' });

    const body = (typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {}));
    const action = body.action;
    const now = Date.now();
    const audit = (a) => rest('POST', '/login_events', {
      user_id: user.id, ip: clientIp(req), user_agent: (req.headers['user-agent'] || ''),
      device_hash: 'admin-action:' + a, kicked_previous: false
    }).catch(() => {});

    if (action === 'stats') {
      const [pRes, eRes, payRes, prRes] = await Promise.all([
        rest('GET', '/profiles?select=id,created_at&order=created_at.desc&limit=2000'),
        rest('GET', '/entitlements?select=user_id,plan,expires_at&limit=5000'),
        rest('GET', '/payments?select=amount_paise,status,created_at&status=eq.paid&limit=5000'),
        rest('GET', '/presence?select=user_id,route,started_at,last_seen_at&order=last_seen_at.desc&limit=2000')
      ]);
      const profiles = (await jsonOf(pRes)) || [], ents = (await jsonOf(eRes)) || [], pays = (await jsonOf(payRes)) || [];
      const presence = (await jsonOf(prRes)) || [];
      const paidUsers = new Set(ents.filter(e => isActive(e, now)).map(e => e.user_id));

      // Presence: online = heartbeat in the last 2 minutes (client pings each
      // minute). Session length = last_seen - started, per tab-session.
      const nowMs = now.getTime();
      const durMin = r => Math.max(0, (new Date(r.last_seen_at) - new Date(r.started_at)) / 60000);
      const online = presence.filter(r => nowMs - new Date(r.last_seen_at).getTime() < 2 * 60000);
      const day = presence.filter(r => nowMs - new Date(r.started_at).getTime() < 24 * 3600000);
      const avgSessionMin = day.length ? day.reduce((s, r) => s + durMin(r), 0) / day.length : 0;

      // Resolve emails for logged-in online visitors.
      const ids = [...new Set(online.map(r => r.user_id).filter(Boolean))].slice(0, 50);
      let emails = {};
      if (ids.length) {
        const inList = '(' + ids.map(encodeURIComponent).join(',') + ')';
        const em = await jsonOf(await rest('GET', '/profiles?select=id,email&id=in.' + inList));
        (em || []).forEach(p => { emails[p.id] = p.email; });
      }
      const onlineList = online.slice(0, 50).map(r => ({
        email: r.user_id ? (emails[r.user_id] || null) : null,
        route: r.route || '', mins: Math.round(durMin(r) * 10) / 10
      }));

      await audit('stats');
      return res.status(200).json({
        users_total: profiles.length,
        paid_count: paidUsers.size,
        revenue_month_paise: revenueThisMonthPaise(pays, now),
        revenue_total_paise: pays.reduce((s, p) => s + (p.amount_paise || 0), 0),
        signups: signupsByDay(profiles, now, 30),
        online_now: online.length,
        sessions_24h: day.length,
        avg_session_min: Math.round(avgSessionMin * 10) / 10,
        online_list: onlineList
      });
    }

    if (action === 'list_users') {
      const q = String(body.q || '').trim();
      const filter = q ? '&email=ilike.' + encodeURIComponent('%' + q + '%') : '';
      const pRes = await rest('GET', '/profiles?select=id,email,name,is_admin,device_limit,created_at&order=created_at.desc&limit=50' + filter);
      const profiles = (await jsonOf(pRes)) || [];
      const ids = profiles.map(p => p.id);
      let ents = [], devs = [], logins = [];
      if (ids.length) {
        const inList = '(' + ids.map(encodeURIComponent).join(',') + ')';
        const [e, d, l] = await Promise.all([
          rest('GET', '/entitlements?select=user_id,plan,expires_at,created_at&user_id=in.' + inList + '&order=created_at.desc&limit=1000'),
          rest('GET', '/devices?select=user_id&user_id=in.' + inList + '&limit=2000'),
          rest('GET', '/login_events?select=user_id,at&user_id=in.' + inList + '&order=at.desc&limit=2000')
        ]);
        ents = (await jsonOf(e)) || []; devs = (await jsonOf(d)) || []; logins = (await jsonOf(l)) || [];
      }
      const rows = profiles.map(p => {
        const myEnt = ents.filter(x => x.user_id === p.id);
        const live = myEnt.find(x => isActive(x, now));
        const lastLogin = logins.filter(x => x.user_id === p.id)[0];
        return {
          id: p.id, email: p.email, name: p.name, is_admin: p.is_admin, device_limit: p.device_limit,
          plan: live ? live.plan : 'free', expires_at: live ? live.expires_at : null,
          devices: devs.filter(x => x.user_id === p.id).length,
          last_login: lastLogin ? lastLogin.at : null
        };
      });
      return res.status(200).json({ users: rows });
    }

    if (action === 'user_detail') {
      const uid = String(body.user_id || '');
      if (!uid) return res.status(400).json({ error: 'user_id_required' });
      const enc = encodeURIComponent(uid);
      const [e, pay, l, d, p] = await Promise.all([
        rest('GET', '/entitlements?select=plan,source,starts_at,expires_at,created_at,payment_id&user_id=eq.' + enc + '&order=created_at.desc&limit=50'),
        rest('GET', '/payments?select=created_at,plan,period,amount_paise,status,razorpay_payment_id&user_id=eq.' + enc + '&order=created_at.desc&limit=50'),
        rest('GET', '/login_events?select=at,ip,user_agent,device_hash,kicked_previous&user_id=eq.' + enc + '&order=at.desc&limit=20'),
        rest('GET', '/devices?select=label,device_hash,first_seen,last_seen&user_id=eq.' + enc + '&order=last_seen.desc&limit=50'),
        rest('GET', '/profiles?select=email,name,is_admin,device_limit,active_session_id&id=eq.' + enc + '&limit=1')
      ]);
      return res.status(200).json({
        profile: ((await jsonOf(p)) || [])[0] || {},
        entitlements: (await jsonOf(e)) || [],
        payments: (await jsonOf(pay)) || [],
        login_events: (await jsonOf(l)) || [],
        devices: (await jsonOf(d)) || []
      });
    }

    if (action === 'grant') {
      const uid = String(body.user_id || ''); const plan = body.plan; const days = parseInt(body.days, 10);
      if (!uid || (plan !== 'starter' && plan !== 'pro') || !(days > 0)) return res.status(400).json({ error: 'bad_input' });
      const dt = grantDates(days, now);
      const r = await rest('POST', '/entitlements', { user_id: uid, plan, source: 'admin', starts_at: dt.starts_at, expires_at: dt.expires_at });
      await audit('grant:' + plan + ':' + days);
      if (!r.ok) return res.status(502).json({ error: 'db_error' });
      return res.status(200).json({ ok: true, expires_at: dt.expires_at });
    }

    if (action === 'revoke') {
      const uid = String(body.user_id || ''); if (!uid) return res.status(400).json({ error: 'user_id_required' });
      const nowIso = new Date(now).toISOString();
      const r = await rest('PATCH',
        '/entitlements?user_id=eq.' + encodeURIComponent(uid) + '&or=(expires_at.gt.' + encodeURIComponent(nowIso) + ',expires_at.is.null)',
        { expires_at: nowIso });
      await audit('revoke');
      if (!r.ok) return res.status(502).json({ error: 'db_error' });
      return res.status(200).json({ ok: true });
    }

    if (action === 'reset_devices') {
      const uid = String(body.user_id || ''); if (!uid) return res.status(400).json({ error: 'user_id_required' });
      await rest('DELETE', '/devices?user_id=eq.' + encodeURIComponent(uid));
      await rest('PATCH', '/profiles?id=eq.' + encodeURIComponent(uid), { active_session_id: null });
      await audit('reset_devices');
      return res.status(200).json({ ok: true });
    }

    if (action === 'set_device_limit') {
      const uid = String(body.user_id || ''); const limit = parseInt(body.limit, 10);
      if (!uid || !(limit >= 1 && limit <= 50)) return res.status(400).json({ error: 'bad_input' });
      const r = await rest('PATCH', '/profiles?id=eq.' + encodeURIComponent(uid), { device_limit: limit });
      await audit('set_device_limit:' + limit);
      if (!r.ok) return res.status(502).json({ error: 'db_error' });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'unknown_action' });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};

module.exports.grantDates = grantDates;
module.exports.revenueThisMonthPaise = revenueThisMonthPaise;
module.exports.signupsByDay = signupsByDay;
