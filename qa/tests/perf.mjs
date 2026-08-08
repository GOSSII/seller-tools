/**
 * Phase 16 performance sweep. Generates synthetic settlement files in Amazon's
 * exact Flat File V2 shape (no real seller data), then times the shipped
 * parser + aggregators in the browser at 1k / 10k / 50k / 100k transaction rows.
 *
 *   node qa/tests/perf.mjs
 */
import { chromium } from 'playwright';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto('file://' + path.join(ROOT, 'web/index.html'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.parseSettlement === 'function');

const out = await page.evaluate(() => {
  const H = 'settlement-id\tsettlement-start-date\tsettlement-end-date\tdeposit-date\ttotal-amount\tcurrency\ttransaction-type\torder-id\tmerchant-order-id\tadjustment-id\tshipment-id\tmarketplace-name\tamount-type\tamount-description\tamount\tfulfillment-id\tposted-date\tposted-date-time\torder-item-code\tmerchant-order-item-id\tmerchant-adjustment-item-id\tsku\tquantity-purchased\tpromotion-id';
  const gen = (rows) => {
    const L = [H, '9\t01.05.2026 00:00:00 UTC\t31.05.2026 00:00:00 UTC\t02.06.2026 00:00:00 UTC\t0.00\tINR' + '\t'.repeat(18)];
    const F = [['ItemPrice', 'Principal', '499.00'], ['ItemFees', 'Fixed closing fee', '-22.00'],
      ['ItemFees', 'Fixed closing fee IGST', '-3.96'], ['other-transaction', 'Amazon Easy Ship Charges', '-75.00']];
    let i = 0;
    while (L.length - 1 < rows) {
      const oid = '40' + (5 + (i % 5)) + '-' + String(1000000 + i).slice(0, 7) + '-' + String(1000000 + i * 7).slice(0, 7);
      const sku = 'SKU-' + (i % 250);
      const d = String(1 + (i % 28)).padStart(2, '0') + '.05.2026';
      for (const [at, ad, amt] of F) {
        L.push(['9', '', '', '', '', '', 'Order', oid, '', '', '', 'Amazon.in', at, ad, amt, 'MFN', d,
          d + ' 10:00:00 UTC', 'OI' + i, '', '', sku, '1', ''].join('\t'));
        if (L.length - 1 >= rows) break;
      }
      i++;
    }
    return L.join('\n');
  };
  const res = [];
  for (const n of [1000, 10000, 50000, 100000]) {
    const text = gen(n);
    const bytes = text.length;
    const t0 = performance.now();
    const p = window.parseSettlement(text);
    const t1 = performance.now();
    window.saAggregate(p);
    const t2 = performance.now();
    window.saFlow(p.records);
    const t3 = performance.now();
    window.skuCompute(p);
    const t4 = performance.now();
    res.push({
      rows: n, mb: +(bytes / 1048576).toFixed(2), records: p.records.length, errors: p.errors.length,
      parseMs: +(t1 - t0).toFixed(0), aggMs: +(t2 - t1).toFixed(0),
      flowMs: +(t3 - t2).toFixed(0), skuMs: +(t4 - t3).toFixed(0),
      totalMs: +(t4 - t0).toFixed(0),
    });
  }
  return { res, mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null };
});

console.log('rows      MB   records  parse  aggregate  flow   perSKU   TOTAL');
for (const r of out.res) {
  console.log(String(r.rows).padEnd(9) + String(r.mb).padEnd(5) + String(r.records).padEnd(9) +
    (r.parseMs + 'ms').padEnd(7) + (r.aggMs + 'ms').padEnd(11) + (r.flowMs + 'ms').padEnd(7) +
    (r.skuMs + 'ms').padEnd(9) + r.totalMs + 'ms' + (r.errors ? '   errors=' + r.errors : ''));
}
if (out.mem) console.log('\nJS heap after the 100k run: ~' + out.mem + ' MB');
await browser.close();
