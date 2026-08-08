# Razorpay support request — enable UPI + recurring payments

**Where:** Razorpay Dashboard → Support (bottom-left "?" / Help) → Create a ticket
(or email `support@razorpay.com` from the account's registered email address).

**Category:** Payments → Payment methods / Product activation
**Subject:** Enable UPI and recurring payments (Subscriptions) on our account

---

## Message (paste this)

Hello Razorpay team,

We run a subscription-based SaaS for Amazon India sellers (Seller Tools India). Our
integration is live and working with Razorpay Checkout, but two things are not
available on our account and both are blocking sales:

**1. UPI is missing from Checkout.**
Our checkout currently shows only cards and netbanking. UPI does not appear as an
option at all, in either test or live mode. UPI is how the majority of our Indian
customers expect to pay, and we are losing conversions at the payment step. Please
enable UPI (both intent and collect) on our account.

**2. Recurring payments / Subscriptions are not enabled.**
We have implemented the Subscriptions API. Subscription objects are created
successfully and the mandate checkout opens, but the charge fails with
"seller does not support recurring payments". In the webhook settings, no
`subscription.*` events are available to subscribe to, which suggests the
Subscriptions product is not enabled on the account.

Please enable:
- Card e-mandates (recurring card payments)
- UPI Autopay (recurring UPI)
- The Subscriptions product, including the `subscription.*` webhook events
  (activated, charged, cancelled, completed, halted, paused, resumed)

Our plans are ₹199/month and ₹999/year (Starter) and ₹499/month and ₹2,499/year
(Pro) — standard low-value SaaS subscriptions, no high-risk category.

If anything further is needed from our side (KYC documents, business details,
website verification, or a product/pricing page review), please tell us exactly
what to submit and we will provide it the same day.

Website: https://amazonsellertools.vercel.app
Business: Seller Tools India (Gossi Studio)
Contact: gossiistudio@gmail.com

Thank you,
Dipesh Goswami

---

## What to have ready if they ask

- **KYC / account activation** must be complete before recurring is granted — check
  Dashboard → Account & Settings → Account activation for any pending item.
- **Website requirements** they commonly verify: pricing page, terms, privacy,
  refund/cancellation policy, contact details. All four exist:
  `/pricing`, `/terms`, `/privacy`, `/refunds`, `/contact`.
- **Refund policy wording** — ours says non-refundable once activated, with refunds
  for duplicate/failed/erroneous charges. Razorpay sometimes asks for a clear
  cancellation policy for subscriptions; ours is "cancel anytime, access lasts
  until the paid period ends".

## After they enable it

1. In Dashboard → Webhooks, add the six `subscription.*` events to the existing
   webhook pointing at `https://amazonsellertools.vercel.app/api/razorpay-webhook`.
2. Flip the auto-renew checkbox default back ON in checkout (it was set to OFF
   while recurring was unavailable).
3. Run one real ₹199 subscription end-to-end and confirm the entitlement appears.
