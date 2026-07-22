# Seller Tools — Web

Single-file static web app. All 9 calculators. No build step, no dependencies,
no backend.

## Deploy (pick one, all take <5 minutes)

**Vercel**
```bash
npm i -g vercel
vercel --prod
```

**Netlify** — drag this folder onto https://app.netlify.com/drop

**GitHub Pages** — push the folder, enable Pages on the branch.

**Any host** — upload `index.html`. That's genuinely it.

## After deploying

1. Replace `YOURDOMAIN.in` in `robots.txt` and `sitemap.xml` with your domain.
2. Submit the sitemap in Google Search Console.
3. Update the `og:` meta tags in `index.html` if you add a share image.

## URLs

Each calculator has its own shareable URL via hash routing:

```
/                      home grid
/#/profit              Profit Calculator
/#/fba-fee             FBA Fee Calculator
/#/fba-storage         FBA Storage Fee Calculator
/#/acos                ACOS Calculator
/#/break-even-acos     Break-Even ACOS Calculator
/#/advertising-roi     Advertising ROI Calculator
/#/marketing-budget    Marketing Budget Planner
/#/launch-budget       Launch Budget Calculator
/#/coupon-roi          Coupon ROI Calculator
```

## Adding a calculator

Add one object to the `CALCS` array in `index.html`:

```js
{
  id:"my-calc", icon:"🧮",
  name:"My Calculator",
  desc:"What it does.",
  fields:[ {k:"x",label:"Input (₹)",t:"num",d:100} ],
  compute(v){
    return {
      stats:[{k:"Result",v:inr(v.x*2),t:"blue"}],
      rows:[{l:"Doubled",v:inr(v.x*2),fin:1}],
    };
  }
}
```

Field types: `num` (add `dec:1` to allow decimals), `sel` (dropdown, needs `o:[{v,l}]`),
`seg` (segmented buttons, needs `o:[{v,l}]`). Add `full:1` to span both columns.

Return keys: `stats` (up to 4 cards), `rows` (breakdown), `banner` (`{t:"info|warn|good", x:"text"}`),
`split` (stacked bar), `bench` (benchmark slider).

The home grid and routing pick it up automatically.

## Note on SEO

Hash routes (`#/profit`) are one page to Google. If ranking for individual
calculator keywords matters, split each calculator into its own real HTML page
at `/amazon-profit-calculator/` etc. and inline only that calculator's code.
Same engine, one file each — worth doing once traffic matters.
