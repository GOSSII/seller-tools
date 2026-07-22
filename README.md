# Seller Tools

Amazon India seller calculators — nine tools, shared fee engine, shipping to
web, Android and iOS.

```
├── web/     static single-file web app (deploy in minutes, no build step)
└── app/     Expo project → Android + iOS (and web, if you prefer one source)
```

## Quick start

**Web** — open `web/index.html` in a browser. That's it. To deploy:

```bash
cd web
npx vercel --prod          # or drag the folder onto app.netlify.com/drop
```

**App** — Expo, runs on all three platforms:

```bash
cd app
npm install
npx expo start             # press w (web), a (Android), i (iOS)
```

## The nine calculators

| Calculator | What it answers |
|---|---|
| Profit Calculator | What do I actually keep per unit? |
| FBA Fee Calculator | What does Amazon take on an FBA sale? |
| FBA Storage Fee Calculator | What is inventory costing me to sit there? |
| ACOS Calculator | How efficient is my ad spend? |
| Break-Even ACOS Calculator | At what ACOS do ads stop paying? |
| Advertising ROI Calculator | What will this PPC budget return? |
| Marketing Budget Planner | What budget does my revenue target need? |
| Launch Budget Calculator | What does launching this SKU cost? |
| Coupon ROI Calculator | Does this discount actually pay for itself? |

## Fee data

Both packages model the same Amazon India fee structure: 23 category referral
tiers by price band, closing fee bands, weight-slab shipping across Local and
National zones, Easy Ship / FBA / Self Ship, FBA pick & pack plus storage, and
18% GST on fees.

- App: `app/src/data/amazonFees.ts`
- Web: the `CATS` / `CLOSING` / `SLABS` constants in `web/index.html`

Verified to the paisa against a reference implementation across low-price/light
and high-price/heavy/oversize cases.

> Amazon revises rates periodically (notably 16 Mar 2026). Confirm against your
> live Seller Central rate card before pricing real inventory.

## Adding a calculator

**App** — create `src/calculators/<name>/` with `engine.ts`, `<Name>Screen.tsx`
and `manifest.ts`, then add one line to `src/registry.ts`. The home grid and
routing pick it up automatically.

**Web** — add one object to the `CALCS` array in `web/index.html`.

Both READMEs cover the details.

## Deployment

| Target | Command | Review? |
|---|---|---|
| Web | `vercel --prod` | none — instant |
| Android | `eas build --platform android` | Play review |
| iOS | `eas build --platform ios` | App Store review |
| App updates (JS only) | `eas update --auto` | none — over the air |

Native changes (permissions, SDK bumps) need a fresh store build; calculator
logic, fee tables and UI ship over the air.

## Naming note

Store title is **Seller Tools**, not "Amazon Tools" — titles implying an
official Amazon app get rejected under Apple 5.2.1 and Google's impersonation
policy. Keywords belong in the subtitle and description, where descriptive use
is accepted.
