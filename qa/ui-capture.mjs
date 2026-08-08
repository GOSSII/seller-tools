/**
 * UI/UX visual capture for the ChatGPT audit.
 *
 * Renders the AUDITED build at real viewports (1440x900 desktop, 390x844
 * mobile), drives each tool through its own file input with the same Amazon
 * files the accuracy audit used, and writes PNGs.
 *
 *   node qa/ui-capture.mjs                 # all three audited tools
 *   node qa/ui-capture.mjs settlement      # one tool
 *
 * Output: qa-data/screenshots/<tool>/...   (gitignored — the transaction table
 * shows real order ids and SKU names)
 *
 * Why not the extension: setting a true 390px viewport is required here, and
 * window resizing does not reflow the extension's tab in this environment.
 * This is a real Chrome rendering the real file, not a source-code view.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:8899';
const OUT = path.join(ROOT, 'qa-data/screenshots');
const S = path.join(ROOT, 'qa-data/raw/SELLER-A/settlements');
const FIX = path.join(ROOT, 'qa/fixtures');
const only = process.argv[2];

const SIX = fs.readdirSync(S).filter((f) => f.endsWith('.txt')).map((f) => path.join(S, f)).sort();
const FILE_B = path.join(S, '54493020605.txt');
const FILE_A = path.join(S, '54492020605.txt');

const TOOLS = [
  { id: 'tool-21-settlement', route: 'settlement-analyzer', input: '#sa-file', files: [FILE_B] },
  { id: 'tool-23-sku-profitability', route: 'sku-report', input: '#sku-file', files: [FILE_B] },
  { id: 'tool-24-trends', route: 'trends', input: '#tr-file', files: SIX },
].filter((t) => !only || t.id.includes(only) || t.route.includes(only));

const shot = async (page, dir, name, opts = {}) => {
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name + '.png');
  await page.screenshot({ path: p, ...opts });
  const kb = Math.round(fs.statSync(p).size / 1024);
  console.log(`    ${name}.png  (${kb} KB)`);
  return p;
};

/** Full page split into overlapping viewport-height slices, so nothing is cropped. */
const slices = async (page, dir, prefix, vh) => {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = Math.round(vh * 0.82);              // ~18% overlap
  const n = Math.max(1, Math.ceil((h - vh) / step) + 1);
  const out = [];
  for (let i = 0; i < n; i++) {
    const y = Math.min(i * step, Math.max(0, h - vh));
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(180);
    out.push(await shot(page, dir, `${prefix}-${String(i + 1).padStart(2, '0')}`));
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return out;
};

const browser = await chromium.launch({ channel: 'chrome' });

for (const tool of TOOLS) {
  for (const vp of [{ n: 'desktop', w: 1440, h: 900 }, { n: 'mobile', w: 390, h: 844 }]) {
    console.log(`\n== ${tool.id} — ${vp.n} ${vp.w}x${vp.h} ==`);
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: 2,
      isMobile: vp.n === 'mobile',
      hasTouch: vp.n === 'mobile',
    });
    const page = await ctx.newPage();
    const dir = path.join(OUT, tool.id, vp.n + '-before');

    // ---- A. initial screen, before upload
    await page.goto(`${BASE}/#/${tool.route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(tool.input, { timeout: 15000 });
    await page.waitForTimeout(350);
    await shot(page, dir, 'A-initial-viewport');
    await shot(page, dir, 'A-initial-fullpage', { fullPage: true });
    // open the how-to accordion — it is the tool's own instructions
    const det = await page.$('details.howto');
    if (det) {
      await page.$eval('details.howto', (d) => { d.open = true; });
      await page.waitForTimeout(250);
      await shot(page, dir, 'A-initial-howto-open', { fullPage: true });
      await page.$eval('details.howto', (d) => { d.open = false; });
    }

    // ---- B/C/D/E. loaded results
    await page.setInputFiles(tool.input, tool.files);
    await page.waitForTimeout(1100);
    await shot(page, dir, 'C-results-top');
    await slices(page, dir, 'RESULTS', vp.h);
    await shot(page, dir, 'FULLPAGE-results', { fullPage: true });

    // ---- table + chart interaction (desktop only; hover is meaningless on touch)
    if (vp.n === 'desktop') {
      const idir = path.join(OUT, tool.id, 'interaction');
      if (tool.route === 'settlement-analyzer') {
        const rowSel = 'tr.exp:not(.nodetail)';
        if (await page.$(rowSel)) {
          await page.$$eval(rowSel, (rs) => rs[0].scrollIntoView({ block: 'center' }));
          await page.waitForTimeout(200);
          await shot(page, idir, 'table-collapsed');
          await page.click(rowSel);
          await page.waitForTimeout(350);
          await shot(page, idir, 'table-expanded-drilldown');
        }
        for (const [nm, sel] of [['filter-refund', 'button[data-f="Refund"]'],
          ['filter-other', 'button[data-f="other-transaction"]']]) {
          if (await page.$(sel)) {
            await page.click(sel); await page.waitForTimeout(300);
            await page.$eval('.tblwrap', (e) => e.scrollIntoView({ block: 'center' }));
            await shot(page, idir, nm);
          }
        }
      }
      const bar = await page.$('.viz-bar');
      if (bar) {
        await page.$eval('.viz', (e) => e.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(200);
        await shot(page, idir, 'chart-normal');
        const bars = await page.$$('.viz-bar');
        await bars[Math.min(2, bars.length - 1)].hover();
        await page.waitForTimeout(400);
        await shot(page, idir, 'chart-hover-tooltip');
      }
      // keyboard focus ring on the first actionable control
      await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
      await shot(page, idir, 'keyboard-focus-state');
    }
    await ctx.close();
  }
}

// ---------------- error / edge states, desktop only ----------------
console.log('\n== error + edge states — desktop 1440x900 ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const dir = path.join(OUT, 'error-states');
  const cases = [
    ['wrong-report-business-report-into-settlement', 'settlement-analyzer', '#sa-file',
      [path.join(ROOT, 'qa-data/raw/SELLER-A/traffic/BusinessReport-08-08-26.csv')]],
    ['wrong-report-allorders-into-settlement', 'settlement-analyzer', '#sa-file',
      [path.join(ROOT, 'qa-data/raw/SELLER-B/allorders/50020020673.txt')]],
    ['header-only-no-rows', 'settlement-analyzer', '#sa-file', [path.join(FIX, 'settlement-header-only.txt')]],
    ['unknown-transaction-type', 'settlement-analyzer', '#sa-file', [path.join(FIX, 'settlement-unknown-row.txt')]],
    ['duplicate-settlement-loaded-twice', 'trends', '#tr-file', [FILE_A, FILE_A]],
    ['settlement-into-traffic-doctor', 'traffic', '#td-file', [FILE_B]],
  ];
  for (const [name, route, input, files] of cases) {
    await page.goto(`${BASE}/#/${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(input, { timeout: 15000 });
    await page.waitForTimeout(300);
    try { await page.setInputFiles(input, files); } catch (e) { console.log('   skip', name, e.message.slice(0, 60)); continue; }
    await page.waitForTimeout(900);
    await shot(page, dir, name, { fullPage: true });
  }
  await ctx.close();
}

await browser.close();
const count = (d) => fs.existsSync(d)
  ? fs.readdirSync(d, { withFileTypes: true })
      .reduce((n, e) => n + (e.isDirectory() ? count(path.join(d, e.name)) : (e.name.endsWith('.png') ? 1 : 0)), 0) : 0;
console.log(`\n${count(OUT)} screenshots in ${path.relative(ROOT, OUT)}/`);
