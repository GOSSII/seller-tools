# Seller Tools — Amazon India Seller Calculators

One Expo codebase → **web + Android + iOS**. Nine calculators, all sharing one
verified fee-data layer. Calculators are self-contained modules registered in
one place; the home grid and navigation build themselves.

## Calculators included (9)

| # | Calculator | What it does |
|---|-----------|--------------|
| 1 | Amazon Profit Calculator | Full fee + profit per SKU (verified to the paisa) |
| 2 | FBA Fee Calculator | FBA fees, fulfilment cost, net settlement |
| 3 | FBA Storage Fee Calculator | Storage cost, months of cover, aged-inventory risk |
| 4 | ACOS Calculator | ACOS, TACoS, ROAS, organic split |
| 5 | Break-Even ACOS Calculator | Break-even & target ACOS, max CPC |
| 6 | Advertising ROI Calculator | Clicks → orders → sales → ROAS from budget |
| 7 | Marketing Budget Planner | Ad budget from revenue target + category TACoS |
| 8 | Product Launch Budget Calculator | PPC + coupons + creative launch plan |
| 9 | Coupon ROI Calculator | Discount cost vs incremental contribution |

## Run it

```bash
npm install
npx expo start        # press w (web), a (Android), i (iOS)
```

First run may prompt `npx expo install` to align native versions — accept it.

## Project shape

```
src/
  theme.ts                     design tokens (colors, spacing, radii)
  registry.ts                  ⭐ add new calculators here (one line)
  data/amazonFees.ts           ⭐ shared fee tables (single source of truth)
  components/                   NumericInput, SegmentedControl, Dropdown, Icon, ui
  calculators/
    types.ts                   the manifest contract
    <name>/ engine.ts + <Name>Screen.tsx + manifest.ts
  screens/                     HomeScreen (auto grid), CalculatorScreen (host)
App.tsx                        navigation
assets/                        icon, splash, adaptive-icon, favicon
```

## Add a new calculator

1. `src/calculators/<name>/engine.ts` — pure functions; import shared tables.
2. `src/calculators/<name>/<Name>Screen.tsx` — UI (reuse `components/ui`).
3. `src/calculators/<name>/manifest.ts` — name, description, icon, badge, group.
4. Add one line to `src/registry.ts`.

Card appears on home and routing works — no other edits.

## Deploy

**Web** (instant): `npm run deploy:web` → upload `dist/` to Vercel/Netlify, or
connect the repo for auto-deploy on push.

**Mobile builds** (EAS):
```bash
npm i -g eas-cli && eas login && eas init
eas build --platform android      # AAB for Play Store
eas build --platform ios          # IPA for App Store
```

**Over-the-air updates** — ship new calculators / fee fixes / UI changes to
installed apps WITHOUT store review:
```bash
eas update --auto
```
Store review is only needed for native changes (permissions, SDK bumps).

## App name / store listing (IMPORTANT)

Store title is **Seller Tools** (trademark-safe). Do NOT title the app
"Amazon Tools" — Apple (5.2.1) and Google reject titles implying an official
Amazon app. Put keywords in the SUBTITLE instead:
> "Amazon India profit, FBA & PPC calculators for sellers"

To change the title: `app.json` → `expo.name`.

## Fee data accuracy

`data/amazonFees.ts` is verified to the paisa against the reference tool, but
Amazon revises rates (notably 16 Mar 2026). Verify against your live Seller
Central rate card before real pricing. Update rates in that ONE file and every
calculator stays in sync.
