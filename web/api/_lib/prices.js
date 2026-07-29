// Single source of truth for plan prices. Imported by create-order.js and
// razorpay-webhook.js. The browser NEVER sends an amount — the server always
// looks it up here by plan key. Underscore-prefixed dir => not a Vercel route.
// sub_total_count: how many auto-renewal cycles a Razorpay subscription may
// run before completing (a generous ceiling, not a commitment — users can
// cancel any time). Razorpay requires the field up front.
const PRICES = {
  starter_monthly: { plan: 'starter', period: 'monthly', amount_paise: 19900,  days: 30,  label: 'Starter (monthly)', sub_total_count: 60 },
  starter_yearly:  { plan: 'starter', period: 'yearly',  amount_paise: 99900,  days: 365, label: 'Starter (yearly)',  sub_total_count: 10 },
  pro_monthly:     { plan: 'pro',     period: 'monthly', amount_paise: 49900,  days: 30,  label: 'Pro (monthly)',     sub_total_count: 60 },
  pro_yearly:      { plan: 'pro',     period: 'yearly',  amount_paise: 249900, days: 365, label: 'Pro (yearly)',      sub_total_count: 10 },
};

const PLAN_RANK = { free: 0, starter: 1, pro: 2 };
function planRank(p) { return PLAN_RANK[p] || 0; }

module.exports = { PRICES, PLAN_RANK, planRank };
