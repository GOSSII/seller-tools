/**
 * Unit tests for the serverless layer — web/api/*.js.
 *
 * The calculation layer has had a regression suite since the 2026-08-08 audit;
 * the billing layer had none, even though every one of these helpers was
 * already written with an explicit "pure, unit-tested helpers" comment and an
 * export at the bottom of its file. A wrong calculator shows a wrong number.
 * A wrong helper here grants a plan nobody paid for, keeps access after a
 * refund, or locks a paying customer out of their own account.
 *
 *   node qa/tests/api-tests.mjs
 *
 * No dependencies and no network: these are pure functions, called directly.
 * Nothing in here needs SUPABASE_* or RAZORPAY_* set — web/api/_lib/supa.js
 * reads env lazily precisely so this is possible. Anything that would touch
 * Postgres or Razorpay (recordPaidAndEntitle, orderFromRazorpay, the handlers
 * themselves) is deliberately out of scope; it belongs in an integration test
 * against a scratch Supabase project, not here.
 *
 * Cases marked "regression:" reproduce a hole that actually shipped. Do not
 * relax one without reading the PR it names.
 */
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const api = n => require(path.join(ROOT, 'web/api', n));

const hook = api('razorpay-webhook.js');
const admin = api('admin.js');
const ping = api('ping.js');
const claim = api('session-claim.js');
const cleanup = api('cleanup.js');
const { PRICES, planRank } = api('_lib/prices.js');
const { allow, ipOf } = api('_lib/ratelimit.js');

let pass = 0, fail = 0, group = '';
const section = (s) => { group = s; console.log(`\n== ${s} ==`); };
const eq = (name, got, want) => {
  const ok = (typeof want === 'number' && typeof got === 'number')
    ? Object.is(got, want)
    : JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`); }
};
const ok = (name, cond) => eq(name, !!cond, true);

// A fixed clock, so every date assertion is exact rather than approximate.
const T0 = Date.parse('2026-09-20T12:00:00.000Z');
const DAY = 86400000;
const iso = ms => new Date(ms).toISOString();

/* ========================================================================
   razorpay-webhook.js — signature
   ===================================================================== */
section('webhook signature (the only thing standing between a POST and a plan)');
{
  const secret = 'whsec_test_value';
  const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1' } } } });
  const good = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');

  ok('a correct signature verifies', hook.verifySignature(raw, good, secret));
  ok('a wrong signature is rejected', !hook.verifySignature(raw, good.replace(/.$/, c => c === 'a' ? 'b' : 'a'), secret));
  ok('a tampered body is rejected', !hook.verifySignature(raw + ' ', good, secret));
  ok('the wrong secret is rejected', !hook.verifySignature(raw, good, 'whsec_other'));
  ok('no signature is rejected', !hook.verifySignature(raw, '', secret));
  ok('no secret is rejected (an unset env must never mean "allow")', !hook.verifySignature(raw, good, ''));
  ok('no body is rejected', !hook.verifySignature('', good, secret));
  // timingSafeEqual throws on unequal lengths — the guard must catch it, not 500.
  ok('a short signature returns false instead of throwing', !hook.verifySignature(raw, 'abc', secret));
  ok('a long signature returns false instead of throwing', !hook.verifySignature(raw, good + 'ff', secret));
  ok('signature comparison is case-sensitive hex', !hook.verifySignature(raw, good.toUpperCase(), secret));
}

/* ========================================================================
   razorpay-webhook.js — price resolution and amount check
   ===================================================================== */
section('price resolution and amount check');
{
  eq('priceFor(pro, monthly)', hook.priceFor('pro', 'monthly').amount_paise, 49900);
  eq('priceFor(starter, yearly)', hook.priceFor('starter', 'yearly').amount_paise, 99900);
  eq('priceFor of an unknown plan is null', hook.priceFor('platinum', 'monthly'), null);
  eq('priceFor of an unknown period is null', hook.priceFor('pro', 'weekly'), null);

  const pro = hook.priceFor('pro', 'monthly');
  ok('exact price in INR passes', hook.amountOk(pro, { amount: 49900, currency: 'INR' }));
  ok('currency absent is treated as INR', hook.amountOk(pro, { amount: 49900 }));
  ok('lower-case inr passes', hook.amountOk(pro, { amount: 49900, currency: 'inr' }));
  // regression: PR #108 — ₹1 must not buy Pro.
  ok('regression: ₹1 does not buy Pro (PR #108)', !hook.amountOk(pro, { amount: 100, currency: 'INR' }));
  ok('a short payment is rejected', !hook.amountOk(pro, { amount: 49899, currency: 'INR' }));
  ok('an overpayment is rejected too', !hook.amountOk(pro, { amount: 99900, currency: 'INR' }));
  ok('a non-INR payment is rejected', !hook.amountOk(pro, { amount: 49900, currency: 'USD' }));
  ok('a missing price is rejected', !hook.amountOk(null, { amount: 49900 }));
  ok('a missing payment is rejected', !hook.amountOk(pro, null));
  ok('a string amount of the right value still passes (Razorpay sends numbers)', hook.amountOk(pro, { amount: '49900' }));
}

/* ========================================================================
   razorpay-webhook.js — computeDates
   This is where paid time is created. Every branch gets a case.
   ===================================================================== */
section('computeDates — renewals, upgrades, downgrades');
{
  const perDay = k => PRICES[k].amount_paise / PRICES[k].days;

  // No existing entitlement: starts now, runs the plan's length.
  let d = hook.computeDates(null, 'pro', 30, T0, perDay('pro_monthly'));
  eq('new buyer starts now', d.starts_at, iso(T0));
  eq('new buyer gets exactly 30 days', d.expires_at, iso(T0 + 30 * DAY));

  // An expired row must not extend anything.
  d = hook.computeDates({ plan: 'pro', expires_at: iso(T0 - DAY) }, 'pro', 30, T0, perDay('pro_monthly'));
  eq('an expired entitlement is ignored', d.expires_at, iso(T0 + 30 * DAY));

  // Same plan = renewal: stacks on the remaining time, 1:1.
  d = hook.computeDates({ plan: 'pro', expires_at: iso(T0 + 10 * DAY) }, 'pro', 30, T0, perDay('pro_monthly'));
  eq('renewal extends from the existing expiry, not from today', d.expires_at, iso(T0 + 40 * DAY));

  // Upgrade: leftover time converts by VALUE, not 1:1.
  // regression: 1:1 stacking let ₹999 of yearly Starter become a year of Pro.
  const starterYearPerDay = PRICES.starter_yearly.amount_paise / PRICES.starter_yearly.days; // 99900/365 ≈ 273.7
  const proMonthPerDay = perDay('pro_monthly');                                              // 49900/30  ≈ 1663.3
  const remaining = 300 * DAY;
  d = hook.computeDates(
    { plan: 'starter', expires_at: iso(T0 + remaining), per_day_paise: starterYearPerDay },
    'pro', 30, T0, proMonthPerDay);
  const ratio = starterYearPerDay / proMonthPerDay;
  eq('regression: upgrade converts leftover Starter by value, not 1:1 (PR #107)',
    d.expires_at, iso(T0 + 30 * DAY + Math.floor(remaining * ratio)));
  ok('…which is far less than stacking 300 days on top',
    Date.parse(d.expires_at) < T0 + 30 * DAY + remaining);
  ok('…and still more than the bare 30 days they just bought',
    Date.parse(d.expires_at) > T0 + 30 * DAY);

  // Unknown per-day values must not invent a bonus.
  d = hook.computeDates({ plan: 'starter', expires_at: iso(T0 + remaining) }, 'pro', 30, T0, proMonthPerDay);
  eq('an upgrade with no per-day price gives no bonus days', d.expires_at, iso(T0 + 30 * DAY));
  d = hook.computeDates(
    { plan: 'starter', expires_at: iso(T0 + remaining), per_day_paise: starterYearPerDay }, 'pro', 30, T0, 0);
  eq('an upgrade with no new per-day price gives no bonus days', d.expires_at, iso(T0 + 30 * DAY));

  // The conversion ratio is capped at 1 — cheap time can never buy more than it is worth.
  d = hook.computeDates(
    { plan: 'starter', expires_at: iso(T0 + 100 * DAY), per_day_paise: 999999 }, 'pro', 30, T0, 1);
  eq('the value ratio is capped at 1:1', d.expires_at, iso(T0 + 30 * DAY + 100 * DAY));

  // Downgrade: a cheaper plan must not eat a costlier plan's remaining time.
  d = hook.computeDates(
    { plan: 'pro', expires_at: iso(T0 + 200 * DAY), per_day_paise: proMonthPerDay },
    'starter', 30, T0, perDay('starter_monthly'));
  eq('a downgrade starts fresh and does not consume Pro time', d.expires_at, iso(T0 + 30 * DAY));

  // A perpetual row (null expiry) has no expiry to extend from.
  d = hook.computeDates({ plan: 'pro', expires_at: null }, 'pro', 30, T0, perDay('pro_monthly'));
  eq('a perpetual entitlement is left alone', d.expires_at, iso(T0 + 30 * DAY));
}

/* ========================================================================
   razorpay-webhook.js — refunds
   ===================================================================== */
section('refunds — money back means access ends');
{
  ok('refund.created revokes', !!hook.REFUND_EVENTS['refund.created']);
  ok('refund.processed revokes', !!hook.REFUND_EVENTS['refund.processed']);
  ok('a lost dispute revokes', !!hook.REFUND_EVENTS['payment.dispute.lost']);
  // An opened dispute is not a settled outcome — revoking there punishes a
  // customer whose seller may still win.
  ok('an OPENED dispute does not revoke', !hook.REFUND_EVENTS['payment.dispute.created']);
  ok('a failed refund does not revoke', !hook.REFUND_EVENTS['refund.failed']);

  eq('payment id read from a refund entity',
    hook.refundedPaymentId({ payload: { refund: { entity: { payment_id: 'pay_A' } } } }), 'pay_A');
  eq('payment id read from a dispute entity',
    hook.refundedPaymentId({ payload: { dispute: { entity: { payment_id: 'pay_B' } } } }), 'pay_B');
  eq('payment id falls back to the payment entity',
    hook.refundedPaymentId({ payload: { payment: { entity: { id: 'pay_C' } } } }), 'pay_C');
  eq('no payload yields null', hook.refundedPaymentId({}), null);
  eq('a null event yields null', hook.refundedPaymentId(null), null);

  const full = { payload: { payment: { entity: { amount: 49900, amount_refunded: 49900 } } } };
  const part = { payload: { payment: { entity: { amount: 249900, amount_refunded: 10000 } } } };
  ok('a full refund revokes', hook.isFullRefund(full) === true);
  // regression: ₹100 of goodwill off a ₹2,499 year must not delete the year.
  ok('regression: a partial refund does NOT revoke', hook.isFullRefund(part) === false);
  ok('a lost dispute always counts as full', hook.isFullRefund({ event: 'payment.dispute.lost' }) === true);
  ok('an over-refund still counts as full',
    hook.isFullRefund({ payload: { payment: { entity: { amount: 100, amount_refunded: 150 } } } }) === true);
  // When the event carries only the refund, our own payments row supplies the total.
  ok('refund-only event uses our recorded amount as the total',
    hook.isFullRefund({ payload: { refund: { entity: { amount: 49900 } } } }, 49900) === true);
  ok('refund-only event detects a partial against our recorded amount',
    hook.isFullRefund({ payload: { refund: { entity: { amount: 5000 } } } }, 49900) === false);
  // "I cannot tell" must be distinguishable from "no" — the caller decides.
  eq('unknown amounts return null, not false', hook.isFullRefund({ payload: {} }, null), null);
  eq('a known total with an unknown refund returns null', hook.isFullRefund({ payload: {} }, 49900), null);
}

/* ========================================================================
   razorpay-webhook.js — subscription status map
   ===================================================================== */
section('subscription lifecycle mapping');
{
  eq('activated → active', hook.SUB_STATUS['subscription.activated'], 'active');
  eq('charged → active', hook.SUB_STATUS['subscription.charged'], 'active');
  eq('cancelled → cancelled', hook.SUB_STATUS['subscription.cancelled'], 'cancelled');
  eq('completed → completed', hook.SUB_STATUS['subscription.completed'], 'completed');
  eq('halted → halted', hook.SUB_STATUS['subscription.halted'], 'halted');
  eq('paused → paused', hook.SUB_STATUS['subscription.paused'], 'paused');
  eq('resumed → active', hook.SUB_STATUS['subscription.resumed'], 'active');
  eq('an unknown event maps to nothing', hook.SUB_STATUS['subscription.invented'], undefined);
}

/* ========================================================================
   _lib/prices.js
   ===================================================================== */
section('price table invariants');
{
  for (const [key, p] of Object.entries(PRICES)) {
    ok(`${key}: positive amount and days`, p.amount_paise > 0 && p.days > 0);
    ok(`${key}: key matches its plan and period`, key === `${p.plan}_${p.period}`);
    ok(`${key}: whole rupees`, p.amount_paise % 100 === 0);
  }
  const perDay = k => PRICES[k].amount_paise / PRICES[k].days;
  ok('yearly Starter is cheaper per day than monthly', perDay('starter_yearly') < perDay('starter_monthly'));
  ok('yearly Pro is cheaper per day than monthly', perDay('pro_yearly') < perDay('pro_monthly'));
  ok('Pro costs more than Starter, monthly', PRICES.pro_monthly.amount_paise > PRICES.starter_monthly.amount_paise);
  ok('Pro costs more than Starter, yearly', PRICES.pro_yearly.amount_paise > PRICES.starter_yearly.amount_paise);

  eq('planRank orders free < starter < pro', [planRank('free'), planRank('starter'), planRank('pro')], [0, 1, 2]);
  eq('an unknown plan ranks as free', planRank('platinum'), 0);
  eq('undefined ranks as free', planRank(undefined), 0);
}

/* ========================================================================
   admin.js — grants
   ===================================================================== */
section('admin grants');
{
  const d = admin.grantDates(30, T0);
  eq('a 30-day grant starts now', d.starts_at, iso(T0));
  eq('a 30-day grant expires in 30 days', d.expires_at, iso(T0 + 30 * DAY));
  eq('a zero-day grant expires immediately', admin.grantDates(0, T0).expires_at, iso(T0));
  eq('a missing day count is treated as zero', admin.grantDates(undefined, T0).expires_at, iso(T0));
}

/* ========================================================================
   admin.js — user search. This string is concatenated into a PostgREST
   filter, so it is the one place in the panel where input shape matters.
   ===================================================================== */
section('admin user search (PostgREST filter construction)');
{
  const f = admin.userSearchFilter;
  eq('an empty query filters nothing', f(''), '');
  eq('whitespace only filters nothing', f('   '), '');
  eq('a word searches email', f('rahul'), '&email=ilike.' + encodeURIComponent('%rahul%'));
  eq('a 10-digit number searches phone and email',
    f('9876543210'), '&or=(phone.like.*9876543210*,email.ilike.*9876543210*)');
  eq('a +91 number is matched against the bare 10 digits stored in profiles',
    f('+91 98765-43210'), '&or=(phone.like.*9876543210*,email.ilike.*919876543210*)');
  eq('a 12-digit 91-prefixed number drops the country code for phone',
    f('919876543210'), '&or=(phone.like.*9876543210*,email.ilike.*919876543210*)');
  eq('brackets and spaces in a number are ignored',
    f('(98765) 43210'), '&or=(phone.like.*9876543210*,email.ilike.*9876543210*)');

  // A comma or bracket reaching or=() would rewrite the filter and could widen
  // the result set past the 50-row page the panel thinks it is showing.
  for (const nasty of ['a,b', 'x)', '(y', 'a,b),(c', "o'brien", '*', '%']) {
    const out = f(nasty);
    ok(`"${nasty}" cannot inject: no raw comma`, !out.includes(','));
    ok(`"${nasty}" cannot inject: no raw bracket`, !out.includes('(') && !out.includes(')'));
    ok(`"${nasty}" stays on the email branch`, out.startsWith('&email=ilike.'));
  }
  // Digits are the only thing that ever reaches or=(), so that branch is safe
  // by construction — assert the construction, not just today's output.
  const digitsOnly = f('1234567890').match(/or=\(phone\.like\.\*([^*]*)\*/)[1];
  ok('only digits reach the or=() list', /^\d+$/.test(digitsOnly));
}

/* ========================================================================
   admin.js — revenue and signup series
   ===================================================================== */
section('admin dashboard series');
{
  const pays = [
    { status: 'paid', amount_paise: 49900, created_at: '2026-09-20T05:00:00Z' }, // today
    { status: 'paid', amount_paise: 19900, created_at: '2026-09-02T05:00:00Z' }, // this month
    { status: 'paid', amount_paise: 99900, created_at: '2026-08-31T23:59:59Z' }, // last month
    { status: 'created', amount_paise: 249900, created_at: '2026-09-10T05:00:00Z' }, // never captured
    { status: 'paid', amount_paise: 1000 },                                      // no timestamp
  ];
  eq('this month counts only captured payments in this month',
    admin.revenueThisMonthPaise(pays, T0), 49900 + 19900);
  eq('last month is its own bucket', admin.revenuePrevMonthPaise(pays, T0), 99900);
  eq('an uncaptured payment is never revenue', admin.revenueThisMonthPaise(
    [{ status: 'created', amount_paise: 100000, created_at: '2026-09-05T00:00:00Z' }], T0), 0);
  eq('no payments is zero, not NaN', admin.revenueThisMonthPaise([], T0), 0);
  eq('null payments is zero, not a crash', admin.revenueThisMonthPaise(null, T0), 0);

  // A December → January rollover must look back a year, not to month -1.
  const jan = Date.parse('2027-01-15T12:00:00Z');
  eq('January looks back to December of the previous year',
    admin.revenuePrevMonthPaise([{ status: 'paid', amount_paise: 5000, created_at: '2026-12-20T00:00:00Z' }], jan), 5000);

  const days = admin.revenueByDay(pays, T0, 30);
  eq('revenueByDay returns one entry per day', days.length, 30);
  eq('revenueByDay ends today', days[29].d, '2026-09-20');
  eq('revenueByDay starts 29 days back', days[0].d, '2026-08-22');
  eq("today's revenue lands on today", days[29].paise, 49900);
  eq('a quiet day is zero, not missing', days[28].paise, 0);
  ok('every day is present and ordered',
    days.every((x, i) => i === 0 || Date.parse(x.d) > Date.parse(days[i - 1].d)));

  const profiles = [
    { created_at: '2026-09-20T01:00:00Z' }, { created_at: '2026-09-20T09:00:00Z' },
    { created_at: '2026-09-19T09:00:00Z' }, { created_at: '2026-01-01T09:00:00Z' },
  ];
  const s = admin.signupsByDay(profiles, T0, 30);
  eq('signupsByDay returns one entry per day', s.length, 30);
  eq('two signups today are both counted', s[29].count, 2);
  eq('yesterday is its own bucket', s[28].count, 1);
  eq('a signup outside the window is not counted', s.reduce((a, b) => a + b.count, 0), 3);
  eq('no profiles gives a full zero series', admin.signupsByDay([], T0, 7).map(x => x.count), [0, 0, 0, 0, 0, 0, 0]);
}

/* ========================================================================
   admin.js — subscription status per user
   ===================================================================== */
section('admin sub status');
{
  const subs = [
    { user_id: 'u1', status: 'halted' }, { user_id: 'u1', status: 'active' },
    { user_id: 'u2', status: 'cancel_requested' },
    { user_id: 'u3', status: 'completed' },
  ];
  eq('active outranks halted for the same user', admin.subStatusOf(subs, 'u1'), 'active');
  eq('a single status is reported as-is', admin.subStatusOf(subs, 'u2'), 'cancel_requested');
  eq('a status outside the live list reports null', admin.subStatusOf(subs, 'u3'), null);
  eq('a user with no subscription reports null', admin.subStatusOf(subs, 'nobody'), null);
  eq('no subscriptions at all reports null', admin.subStatusOf(null, 'u1'), null);
}

/* ========================================================================
   admin.js — visitor counts. Rows and "today" are IST calendar days.
   ===================================================================== */
section('admin visitor stats');
{
  const rows = [
    { day: '2026-09-20', visitors: 12, month_new: 5, first_ever: 3, sessions: 20 },
    { day: '2026-09-19', visitors: 8, month_new: 4, first_ever: 2, sessions: 11 },
    { day: '2026-09-01', visitors: 6, month_new: 6, first_ever: 6, sessions: 6 },
    { day: '2026-08-15', visitors: 9, month_new: 7, first_ever: 4, sessions: 10 },
  ];
  const v = admin.visitorStats(rows, T0, 30);
  eq("today's visitors", v.today, 12);
  eq("today's first-time visitors", v.today_new, 3);
  eq("today's sessions", v.today_sessions, 20);
  eq("yesterday's visitors", v.yesterday, 8);
  // Unique-this-month sums month_new, NOT daily visitors — a regular must not
  // be counted once per day.
  eq('this month is unique visitors, not the sum of daily visitors', v.month, 5 + 4 + 6);
  eq('last month is its own bucket', v.prev_month, 7);
  eq('last month is labelled', v.prev_month_key, '2026-08');
  eq('all-time total sums first_ever across every row', v.total, 3 + 2 + 6 + 4);
  eq('the earliest row dates the counter', v.since, '2026-08-15');
  eq('the daily series has one entry per day', v.days.length, 30);
  eq('the daily series ends today', v.days[29].d, '2026-09-20');
  eq('a day with no row reads zero', v.days[0].count, 0);
  eq('no rows at all is all zeroes', admin.visitorStats([], T0, 7).total, 0);
  eq('null rows does not crash', admin.visitorStats(null, T0, 7).today, 0);

  // 19:00 UTC is already the next day in IST — the row for that IST day is
  // "today", not the UTC one.
  const lateUtc = Date.parse('2026-09-20T19:00:00Z');
  eq('after 18:30 UTC, today is the next IST day',
    admin.visitorStats([{ day: '2026-09-21', visitors: 4, month_new: 1, first_ever: 1, sessions: 4 }], lateUtc, 3).today, 4);
}

/* ========================================================================
   ping.js — IST days, bots, visit flags
   ===================================================================== */
section('ping — IST day boundary');
{
  eq('midday UTC is the same IST day', ping.istDay(Date.parse('2026-09-20T12:00:00Z')), '2026-09-20');
  eq('18:29 UTC is still the same IST day', ping.istDay(Date.parse('2026-09-20T18:29:59Z')), '2026-09-20');
  eq('18:30 UTC has rolled over in IST', ping.istDay(Date.parse('2026-09-20T18:30:00Z')), '2026-09-21');
  eq('just after UTC midnight is still the previous IST evening',
    ping.istDay(Date.parse('2026-09-21T00:01:00Z')), '2026-09-21');
  eq('a year boundary rolls over in IST', ping.istDay(Date.parse('2026-12-31T18:30:00Z')), '2027-01-01');
}

section('ping — bot detection (a crawler is not a visitor)');
{
  const chrome = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
  ok('a real Chrome UA is a visitor', !ping.isBotUa(chrome));
  ok('an iPhone Safari UA is a visitor',
    !ping.isBotUa('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'));
  ok('an empty UA is not counted', ping.isBotUa(''));
  ok('a missing UA is not counted', ping.isBotUa(undefined));
  for (const ua of ['Googlebot/2.1', 'Mozilla/5.0 (compatible; bingbot/2.0)', 'ClaudeBot/1.0',
    'PerplexityBot', 'HeadlessChrome/140.0.0.0', 'Chrome-Lighthouse', 'Google Page Speed Insights',
    'Playwright/1.4', 'puppeteer', 'YandexSpider', 'Slurp', 'prerender']) {
    ok(`"${ua.slice(0, 28)}" is not counted as a visitor`, ping.isBotUa(ua));
  }
  // Our own prerender and responsive sweeps drive real Chrome via Playwright;
  // they must not inflate the owner's visitor numbers.
  ok('our own Playwright sweeps are excluded', ping.isBotUa(chrome + ' Playwright'));
}

section('ping — visit flags (the nesting is what keeps counts honest)');
{
  eq('a normal first-of-day ping counts one visitor',
    ping.visitIncrements({ d: 1 }, false), { v: 1, m: 0, f: 0, s: 0 });
  eq('first this month also counts as monthly-new',
    ping.visitIncrements({ d: 1, m: 1 }, false), { v: 1, m: 1, f: 0, s: 0 });
  eq('first ever implies first this month',
    ping.visitIncrements({ d: 1, f: 1 }, false), { v: 1, m: 1, f: 1, s: 0 });
  // A client cannot claim "first ever" without also being counted today.
  eq('f without d counts nothing', ping.visitIncrements({ f: 1 }, false), null);
  eq('m without d counts nothing', ping.visitIncrements({ m: 1 }, false), null);
  eq('a later ping the same day counts nothing', ping.visitIncrements(null, false), null);
  eq('a new tab still records a session', ping.visitIncrements(null, true), { v: 0, m: 0, f: 0, s: 1 });
  eq('a first-of-day ping in a new tab counts both',
    ping.visitIncrements({ d: 1, f: 1 }, true), { v: 1, m: 1, f: 1, s: 1 });
  eq('a non-object visit is ignored', ping.visitIncrements('yes', false), null);
  eq('d must be exactly 1, not truthy', ping.visitIncrements({ d: 99 }, false), null);
  eq('a huge f is not honoured', ping.visitIncrements({ d: 1, f: 500 }, false), { v: 1, m: 0, f: 0, s: 0 });
}

/* ========================================================================
   session-claim.js
   ===================================================================== */
section('device labels');
{
  const L = claim.deviceLabelFromUA;
  // Every Chromium UA contains "Safari/", and Edge contains "Chrome/" too, so
  // the ordering of these tests is the point.
  eq('Chrome on macOS', L('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'), 'Chrome on macOS');
  eq('Edge is not reported as Chrome', L('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0'), 'Edge on Windows');
  eq('Opera is not reported as Chrome', L('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36 OPR/100.0.0.0'), 'Opera on Windows');
  eq('Safari on iOS', L('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'), 'Safari on iOS');
  eq('Firefox on Linux', L('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0'), 'Firefox on Linux');
  // Android UAs also say Linux — Android has to win.
  eq('Android beats Linux', L('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'), 'Chrome on Android');
  eq('an iPad is iOS', L('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/604.1'), 'Safari on iOS');
  eq('an unknown UA degrades politely', L('curl/8.4.0'), 'Browser on device');
  eq('an empty UA degrades politely', L(''), 'Browser on device');
  eq('a null UA does not crash', L(null), 'Browser on device');
}

section('device limit');
{
  const E = claim.evaluateClaim;
  let r = E(null, [], 'hashA', 3);
  ok('the first device is new', r.isNewDevice);
  ok('the first device is under the limit', !r.overLimit);
  ok('nothing is kicked when no session was active', !r.kickedPrevious);

  r = E('sess-old', ['hashA'], 'hashA', 3);
  ok('a returning device is not new', !r.isNewDevice);
  ok('a returning device is never over the limit', !r.overLimit);
  ok('claiming supersedes the previous session', r.kickedPrevious);

  r = E(null, ['a', 'b'], 'c', 3);
  ok('the third distinct device is allowed at a limit of 3', !r.overLimit);
  r = E(null, ['a', 'b', 'c'], 'd', 3);
  ok('the fourth distinct device is blocked at a limit of 3', r.overLimit);
  // The important half: being at the limit must not lock out a device the
  // user already has. That would paywall a paying customer on their own laptop.
  r = E(null, ['a', 'b', 'c'], 'b', 3);
  ok('at the limit, a KNOWN device still gets in', !r.overLimit);

  r = E(null, ['a', 'b', 'c', 'd', 'e'], 'f', 10);
  ok('a raised limit is honoured', !r.overLimit);
  r = E(null, ['a', 'b', 'c'], 'd', 0);
  ok('a missing/zero limit falls back to 3', r.overLimit);
  r = E(null, null, 'a', 3);
  ok('no known devices does not crash', r.isNewDevice && !r.overLimit);
}

/* ========================================================================
   cleanup.js — retention must match what privacy.html promises
   ===================================================================== */
section('retention purge');
{
  eq('presence is kept 2 days', cleanup.DAYS.presence, 2);
  eq('client errors are kept 30 days', cleanup.DAYS.client_errors, 30);
  eq('login events are kept 180 days', cleanup.DAYS.login_events, 180);
  eq('2-day cutoff', cleanup.cutoffIso(2, T0), iso(T0 - 2 * DAY));
  eq('180-day cutoff', cleanup.cutoffIso(180, T0), iso(T0 - 180 * DAY));
  ok('every retention window is a positive number of days',
    Object.values(cleanup.DAYS).every(d => typeof d === 'number' && d > 0));
}

/* ========================================================================
   _lib/ratelimit.js
   ===================================================================== */
section('rate limiting');
{
  // The FIRST X-Forwarded-For entry is caller-supplied. Trusting it lets one
  // machine mint a fresh bucket per request by inventing a new leading hop —
  // and lets it attribute its writes to an IP of its choosing.
  eq('Vercel\'s own header wins',
    ipOf({ headers: { 'x-vercel-forwarded-for': '9.9.9.9', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' } }), '9.9.9.9');
  eq('otherwise the LAST forwarded hop is trusted',
    ipOf({ headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' } }), '3.3.3.3');
  eq('a spoofed leading hop is ignored',
    ipOf({ headers: { 'x-forwarded-for': 'evil, 3.3.3.3' } }), '3.3.3.3');
  eq('x-real-ip is the last resort', ipOf({ headers: { 'x-real-ip': '4.4.4.4' } }), '4.4.4.4');
  eq('no headers at all is "unknown", never undefined', ipOf({ headers: {} }), 'unknown');
  eq('a request with no headers object does not crash', ipOf({}), 'unknown');

  const reqFrom = ip => ({ headers: { 'x-vercel-forwarded-for': ip } });
  const t = Date.parse('2026-09-20T00:00:00Z');
  const a = reqFrom('10.0.0.1');
  let allowed = 0;
  for (let i = 0; i < 5; i++) if (allow(a, 3, 60000, t)) allowed++;
  eq('a limit of 3 allows exactly 3 in the window', allowed, 3);
  ok('a different IP has its own bucket', allow(reqFrom('10.0.0.2'), 3, 60000, t));
  ok('the original IP is still blocked', !allow(a, 3, 60000, t + 59999));
  ok('the bucket refills after the window', allow(a, 3, 60000, t + 60000));
}

/* ===================================================================== */
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
