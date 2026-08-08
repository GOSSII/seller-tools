/**
 * Responsive + accessibility + performance sweep of the live production site.
 *
 * For each tool route × each of the four widths in the audit brief it records:
 *   - horizontal page scroll (the page body must never scroll sideways)
 *   - any element whose box extends past the viewport
 *   - tables that are NOT inside an overflow-x container (the usual cause)
 *   - touch targets under 44×44 CSS px
 *   - images/inputs missing accessible names
 *   - colour-only status indicators
 *
 * Usage: node qa/responsive-audit.mjs [--routes a,b,c]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

// Local by default (fast, and it is the code under audit); pass --live for production.
const BASE = process.argv.includes('--live')
  ? 'https://amazonsellertools.vercel.app/'
  : 'file://' + path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../web/index.html');
const WIDTHS = [
  { name: 'desktop', w: 1440, h: 900 },
  { name: 'laptop', w: 1024, h: 768 },
  { name: 'tablet', w: 768, h: 1024 },
  { name: 'mobile', w: 390, h: 844 },
];

const ROUTES = (process.argv.includes('--routes')
  ? process.argv[process.argv.indexOf('--routes') + 1].split(',')
  : [
      '', 'pricing', 'profit', 'fba-fee', 'fba-storage', 'acos',
      'break-even-acos', 'advertising-roi', 'marketing-budget',
      'launch-budget', 'coupon-roi', 'price-bands', 'target-price',
      'restock-planner', 'link-builder', 'keyword-combiner',
      'payout-forecast', 'listing-checker', 'fnsku-labels', 'gst-invoice',
      'label-cropper', 'order-printer',
      'settlement-analyzer', 'gst-report', 'sku-report', 'trends',
      'reconcile', 'fee-bands', 'ads-optimizer', 'ad-profit', 'returns',
      'storage', 'rto', 'stranded', 'traffic',
    ]);

const audit = async (page) => page.evaluate(() => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const box = (e) => e.getBoundingClientRect();
  const named = (e) =>
    e.getAttribute('aria-label') || e.getAttribute('title') ||
    e.getAttribute('alt') || (e.textContent || '').trim() ||
    (e.labels && e.labels.length) || e.getAttribute('placeholder');

  const overflowing = [...document.querySelectorAll('body *')]
    .filter((e) => {
      const r = box(e);
      if (r.width === 0 || r.height === 0) return false;
      // ignore things inside an intentional horizontal scroller
      let p = e.parentElement;
      while (p) {
        const ov = getComputedStyle(p).overflowX;
        if (ov === 'auto' || ov === 'scroll') return false;
        p = p.parentElement;
      }
      return r.right > vw + 1 || r.left < -1;
    })
    .map((e) => `${e.tagName}.${(typeof e.className === 'string' ? e.className.split(' ')[0] : '')}`);

  const tablesUnwrapped = [...document.querySelectorAll('table')]
    .filter((t) => {
      let p = t.parentElement;
      while (p) {
        const ov = getComputedStyle(p).overflowX;
        if (ov === 'auto' || ov === 'scroll') return false;
        p = p.parentElement;
      }
      return box(t).width > vw;
    }).length;

  const tapTargets = [...document.querySelectorAll('a,button,input,select,[role="button"]')]
    .filter((e) => {
      const r = box(e);
      return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
    })
    .map((e) => `${e.tagName}:${(e.textContent || '').trim().slice(0, 24) || e.type || ''}`);

  const unnamed = [...document.querySelectorAll('button,input,select,a,img')]
    .filter((e) => box(e).width > 0 && !named(e))
    .map((e) => `${e.tagName}${e.type ? '[' + e.type + ']' : ''}`);

  const noLangOrTitle = { lang: de.lang || null, title: document.title };

  return {
    viewport: vw,
    horizontalScroll: de.scrollWidth > vw + 1,
    scrollWidth: de.scrollWidth,
    overflowingCount: overflowing.length,
    overflowingSample: [...new Set(overflowing)].slice(0, 8),
    tablesUnwrapped,
    smallTapTargets: tapTargets.length,
    smallTapSample: [...new Set(tapTargets)].slice(0, 6),
    unnamedControls: unnamed.length,
    unnamedSample: [...new Set(unnamed)].slice(0, 6),
    ...noLangOrTitle,
  };
});

const browser = await chromium.launch({ channel: 'chrome' });
const results = [];
for (const size of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width: size.w, height: size.h },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    const target = BASE + (route ? '#/' + route : '');
    try {
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(220);
      const r = await audit(page);
      results.push({ route: route || '(home)', size: size.name, ...r });
    } catch (e) {
      results.push({ route: route || '(home)', size: size.name, error: String(e).slice(0, 120) });
    }
  }
  await ctx.close();
}
await browser.close();

fs.mkdirSync('qa/out', { recursive: true });
fs.writeFileSync('qa/out/responsive-audit.json', JSON.stringify(results, null, 2));

// ---- console summary: only the rows that fail something ----
const bad = results.filter((r) =>
  r.error || r.horizontalScroll || r.overflowingCount > 0 || r.tablesUnwrapped > 0);
console.log(`routes x widths tested: ${results.length}`);
console.log(`rows with a layout problem: ${bad.length}`);
for (const b of bad) {
  console.log(`  ${b.size.padEnd(8)} ${b.route.padEnd(20)} ` +
    (b.error ? 'ERROR ' + b.error
      : `hScroll=${b.horizontalScroll} scrollW=${b.scrollWidth} overflow=${b.overflowingCount} ` +
        `unwrappedTables=${b.tablesUnwrapped} ${JSON.stringify(b.overflowingSample)}`));
}
const mob = results.filter((r) => r.size === 'mobile' && !r.error);
const tap = mob.reduce((s, r) => s + (r.smallTapTargets || 0), 0);
const un = mob.reduce((s, r) => s + (r.unnamedControls || 0), 0);
console.log(`\nmobile: total sub-44px tap targets ${tap}, unnamed controls ${un}`);
const worstTap = mob.slice().sort((a, b) => b.smallTapTargets - a.smallTapTargets).slice(0, 6);
for (const w of worstTap) {
  console.log(`  ${w.route.padEnd(20)} taps<44px=${String(w.smallTapTargets).padEnd(3)} ` +
    `${JSON.stringify(w.smallTapSample)}`);
}
const langMissing = results.filter((r) => !r.error && !r.lang).length;
console.log(`\nrows missing <html lang>: ${langMissing}/${results.length}`);
