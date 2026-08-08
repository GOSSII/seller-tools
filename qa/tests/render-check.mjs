/**
 * Renders the premium tools from web/index.html against a real Amazon file and
 * prints the visible stat cards, money ledger and banners — the before/after
 * evidence for Phase 20.
 *
 * The only thing altered is the server-side entitlement gate: a temporary COPY
 * of index.html has `gatePremium(INFO, body)` rewritten to `body()` so the
 * paywall does not stand between the audit and the markup. The shipped file is
 * never modified, and every number comes from the real ingest path — the file
 * is delivered to the tool's own <input type=file>, exactly as a drop would.
 *
 *   node qa/tests/render-check.mjs <settlement-file> [...]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const files = process.argv.slice(2);
if (!files.length) { console.error('usage: render-check.mjs <file> [...]'); process.exit(2); }

const src = fs.readFileSync(path.join(ROOT, 'web/index.html'), 'utf8');
// one call site passes a computed info object, so match up to the final comma
const patched = src.replace(/gatePremium\([^\n]*?,\s*([A-Za-z0-9_]+)\s*\);/g, '$1();');
if (patched === src) { console.error('gate pattern not found — check gatePremium call sites'); process.exit(2); }
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sti-render-'));
const tmp = path.join(tmpDir, 'index.html');
fs.writeFileSync(tmp, patched);

const TOOLS = [
  { route: 'settlement-analyzer', input: '#sa-file' },
  { route: 'sku-report', input: '#sku-file' },
  { route: 'trends', input: '#tr-file' },
];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
await page.goto('file://' + tmp, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.parseSettlement === 'function');

for (const tool of TOOLS) {
  console.log('\n' + '='.repeat(76));
  console.log(`${tool.route}   ←   ${files.map((f) => path.basename(f)).join(', ')}`);
  console.log('='.repeat(76));
  await page.evaluate((r) => { location.hash = '#/' + r; }, tool.route);
  await page.waitForSelector(tool.input, { timeout: 10000 });
  const multiple = await page.$eval(tool.input, (e) => e.multiple);
  await page.setInputFiles(tool.input, multiple ? files : [files[0]]);
  await page.waitForTimeout(900);

  const out = await page.evaluate(() => {
    const stats = [...document.querySelectorAll('.stat')].map((e) => {
      const k = e.querySelector('.k'), v = e.querySelector('.v'), s = e.querySelector('.sa-sub');
      return '  ' + (k ? k.textContent.trim() : '') + ' = ' + (v ? v.textContent.trim() : '') +
        (s ? '\n        [' + s.textContent.trim().replace(/\s+/g, ' ') + ']' : '');
    });
    const rows = [...document.querySelectorAll('.rows .r')].map((r) => {
      const l = r.querySelector('.rl'), v = r.querySelector('.rv');
      return '    ' + (l ? l.textContent.trim() : '').padEnd(66).slice(0, 66) +
        '  ' + (v ? v.textContent.trim() : '');
    });
    const banners = [...document.querySelectorAll('.banner')]
      .map((b) => b.textContent.trim().replace(/\s+/g, ' ')).filter((t) => t.length > 20);
    return { stats, rows, banners };
  });
  out.stats.forEach((s) => console.log(s));
  if (out.rows.length) { console.log('\n  Where the money went:'); out.rows.forEach((r) => console.log(r)); }
  if (out.banners.length) {
    console.log('\n  Banners:');
    out.banners.slice(0, 5).forEach((b) => console.log('    » ' + b.slice(0, 260)));
  }
}

if (errs.length) { console.log('\nPAGE ERRORS:'); errs.forEach((e) => console.log('  ' + e)); }
await browser.close();
fs.rmSync(tmpDir, { recursive: true, force: true });
