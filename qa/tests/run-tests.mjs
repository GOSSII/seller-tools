/**
 * Regression suite for the Seller Tools India calculation layer.
 *
 * Loads the real web/index.html in a browser and drives the app's own exported
 * functions — so this tests the shipped code, not a copy of it. Expected values
 * come from qa/reference-calculations/*.py, which parse the same fixtures
 * independently.
 *
 *   node qa/tests/run-tests.mjs                 # sanitized fixtures (committed)
 *   node qa/tests/run-tests.mjs --real          # + real seller files, if present
 *
 * Real seller data lives in qa-data/ and is gitignored; --real is how the audit
 * proves a fix against the identical SHA-256 file it was found on.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const PAGE = 'file://' + path.join(ROOT, 'web/index.html');
const FIX = path.join(ROOT, 'qa/fixtures');
const REAL = path.join(ROOT, 'qa-data/raw');
const useReal = process.argv.includes('--real');

let pass = 0, fail = 0;
const eq = (name, got, want, tol = 0.005) => {
  const ok = typeof want === 'number'
    ? Number.isFinite(got) && Math.abs(got - want) <= tol
    : JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`); }
};

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.parseSettlement === 'function', { timeout: 15000 });

const analyse = (text) => page.evaluate((t) => {
  const p = window.parseSettlement(t);
  const agg = window.saAggregate(p);
  const flow = window.saFlow(p.records);
  const skus = window.skuCompute(p);
  const gst = window.gstCompute(p);
  return {
    errors: p.errors.length,
    records: p.records.length,
    depositTotal: p.summary ? p.summary.totalAmount : null,
    allSum: +agg.allSum.toFixed(2),
    fees: +agg.fees.toFixed(2),
    tax: +agg.tax.toFixed(2),
    ads: +(agg.ads || 0).toFixed(2),
    balance: +(agg.balance || 0).toFixed(2),
    unknown: +(agg.unknown || 0).toFixed(2),
    credits: +agg.credits.toFixed(2),
    gross: +flow.B.gross.toFixed(2),
    refunded: +flow.B.refunded.toFixed(2),
    bAds: +(flow.B.ads || 0).toFixed(2),
    bBalance: +(flow.B.balance || 0).toFixed(2),
    units: flow.units,
    orders: flow.orders,
    distinctOrders: flow.distinctOrders,
    flowSum: +Object.values(flow.B).reduce((s, x) => s + x, 0).toFixed(2),
    realSkus: skus.filter((s) => s.sku !== '(no SKU)').map((s) => s.sku).sort(),
    acctNet: +((skus.find((s) => s.sku === '(no SKU)') || { net: 0 }).net).toFixed(2),
    gstItc: +gst.itcTotal ? +gst.itcTotal.toFixed(2) : null,
  };
}, text);

console.log('\n== parser + classification: sanitized fixtures ==');
{
  const f = fs.readFileSync(path.join(FIX, 'settlement-balance-and-ads.txt'), 'utf8');
  const r = await analyse(f);
  eq('fixture-1 parses with no row errors', r.errors, 0);
  eq('fixture-1 sum of all lines = deposit total', r.allSum, r.depositTotal);
  eq('fixture-1 money-flow buckets sum to the deposit', r.flowSum, r.depositTotal);
  eq('fixture-1 gross product sales', r.gross, 898.0);
  eq('fixture-1 refunded sales', r.refunded, -499.0);
  // BUG-001: balance movements must NOT be counted as Amazon fees
  eq('BUG-001 Amazon fees exclude balance movements', r.fees, -169.0);
  eq('BUG-001 balance movement tracked separately', r.balance, -500.0);
  eq('BUG-001 balance not filed as a credit', r.credits, 0);
  eq('BUG-001 flow has its own balance bucket', r.bBalance, -500.0);
  // BUG-002: Cost of Advertising must be recognised as advertising
  eq('BUG-002 advertising detected from amount-type', r.ads, -780.21);
  eq('BUG-002 flow has its own advertising bucket', r.bAds, -780.21);
  eq('BUG-002 advertising is not inside Amazon fees', r.fees, -169.0);
  // BUG-003: the synthetic (no SKU) row is not a product
  eq('BUG-003 real SKUs only', r.realSkus, ['FIX-SKU-A', 'FIX-SKU-B']);
  eq('BUG-003 account-level bucket holds the non-SKU lines', r.acctNet, -1280.21);
  eq('fixture-1 GST on fees', r.tax, -30.42);
  eq('fixture-1 has nothing unrecognised', r.unknown, 0);
}
{
  const f = fs.readFileSync(path.join(FIX, 'settlement-multiunit-bom.csv'), 'utf8');
  const r = await analyse(f);
  eq('BOM + CRLF + comma-delimited parses', r.errors, 0);
  eq('multi-unit order: units summed over the repeated rows', r.units, 3);
  eq('multi-unit order: counted as ONE order', r.distinctOrders, 1);
  eq('multi-unit gross', r.gross, 1797.0);
  eq('multi-unit reconciles', r.allSum, r.depositTotal);
}

console.log('\n== classifier unit checks ==');
{
  const cases = await page.evaluate(() => {
    const k = (d, t, amt, tt) => window.saLineKind(
      { amountDescription: d, amountType: t, amount: amt }, tt);
    return {
      principal: k('Principal', 'ItemPrice', 399, 'Order'),
      adsByType: k('TransactionTotalAmount', 'Cost of Advertising', -780.21, 'ServiceFee'),
      balanceByType: k('Debt adjustment against COD Transactions and Non-Transactional Fee Accounts',
        'Debt Adjustment', -1639.24, 'Debt Adjustment'),
      payable: k('Payable to Amazon', 'other-transaction', -3785.33, 'other-transaction'),
      reserve: k('Current Reserve Amount', 'other-transaction', -100, 'other-transaction'),
      igstSuffix: k('MFNPostagePurchaseCompleteIGST', 'other-transaction', -9.9, 'other-transaction'),
      closingFee: k('Fixed closing fee', 'ItemFees', -22, 'Order'),
      tcs: k('TCS-IGST', 'ItemTCS', -2.14, 'Order'),
      tds: k('TDS (Section 194-O)', 'ItemTDS', -21.39, 'Order'),
      easyShip: k('Amazon Easy Ship Charges', 'other-transaction', -55, 'other-transaction'),
      positiveUnknown: k('Some Credit', 'other-transaction', 50, 'other-transaction'),
      negativeUnknown: k('Brand New Amazon Charge 2027', 'other-transaction', -327.5, 'other-transaction'),
      reimbursement: k('FBA Inventory Reimbursement', 'other-transaction', 744, 'other-transaction'),
      adsPositive: k('TransactionTotalAmount', 'Cost of Advertising', +100, 'ServiceFee'),
      feeReversalPositive: k('Amazon Easy Ship Weight Handling Fee Reversal', 'other-transaction', 75, 'other-transaction'),
    };
  });
  eq('Principal', cases.principal, 'principal');
  eq('Cost of Advertising -> ads (amount-type wins over the token description)', cases.adsByType, 'ads');
  eq('Debt Adjustment -> balance', cases.balanceByType, 'balance');
  eq('Payable to Amazon -> balance', cases.payable, 'balance');
  eq('Reserve rows -> balance', cases.reserve, 'balance');
  eq('...CompleteIGST (no word boundary) -> tax', cases.igstSuffix, 'tax');
  eq('Fixed closing fee -> fee', cases.closingFee, 'fee');
  eq('TCS -> tax', cases.tcs, 'tax');
  eq('TDS 194-O -> tax', cases.tds, 'tax');
  eq('Easy Ship -> fee', cases.easyShip, 'fee');
  // ChatGPT's hardening points B and C: never infer from the sign alone
  eq('unrecognised positive row -> unknown, NOT credit', cases.positiveUnknown, 'unknown');
  eq('unrecognised negative row -> unknown, NOT fee', cases.negativeUnknown, 'unknown');
  eq('a real reimbursement is still a credit', cases.reimbursement, 'credit');
  eq('advertising stays advertising when the amount is POSITIVE', cases.adsPositive, 'ads');
  eq('a fee reversal is still a fee line, positive', cases.feeReversalPositive, 'fee');
}

console.log('\n== fee engine vs real Amazon charges (observed in live settlements) ==');
{
  const fe = await page.evaluate(() => ({
    close399: closingFee(399, 'easyship', 'home-kitchen'),
    close499: closingFee(499, 'easyship', 'home-kitchen'),
    close250: closingFee(250, 'easyship', 'home-kitchen'),
    close1500: closingFee(1500, 'easyship', 'home-kitchen'),
    es04: esWeightHandling(0.4, 'standard'),
    es09: esWeightHandling(0.9, 'standard'),
    es19: esWeightHandling(1.9, 'standard'),
    ref399: refRate('home-kitchen', 399),
    ref1500: refRate('home-kitchen', 1500),
    settle499: (function () {
      const c = CALCS.find((x) => x.id === 'profit');
      const v = { sp: 499, cost: 0, cat: 'home-kitchen', kg: 0.9, L: 1, W: 1, H: 1,
        ful: 'easyship', zone: 'local', pack: 0, acos: 0, ret: 0, gstreg: 0 };
      const r = c.compute(v);
      return Number(String(r.stats[0].v).replace(/[^0-9.]/g, ''));
    })(),
  }));
  eq('closing fee at Rs 399 (Amazon charged Rs 22.00)', fe.close399, 22);
  eq('closing fee at Rs 499 (Amazon charged Rs 22.00)', fe.close499, 22);
  eq('closing fee at Rs 250', fe.close250, 1);
  eq('closing fee above Rs 1,000', fe.close1500, 76);
  eq('Easy Ship 0.4 kg (Amazon charged Rs 55.00)', fe.es04, 55);
  eq('Easy Ship 0.9 kg (Amazon charged Rs 75.00)', fe.es09, 75);
  eq('Easy Ship 1.9 kg', fe.es19, 112);
  eq('referral 0% below Rs 1,000 (no referral line in the real settlement)', fe.ref399, 0);
  eq('referral above Rs 1,000', fe.ref1500, 0.125);
  eq('profit calc settlement for the real Rs 499 order (Amazon paid Rs 384.54)', fe.settle499, 384.54);
}

console.log('\n== calculator edge cases ==');
{
  const c = await page.evaluate(() => {
    const run = (id, v) => {
      const calc = CALCS.find((x) => x.id === id);
      const d = {}; calc.fields.forEach((f) => (d[f.k] = f.d));
      return calc.compute(Object.assign(d, v));
    };
    const acosZero = run('acos', { spend: 5000, adSales: 0, total: 0 });
    const acosOk = run('acos', { spend: 5000, adSales: 20000, total: 50000 });
    return {
      acosZeroText: String(acosZero.stats[0].v),
      acosZeroTone: acosZero.stats[0].t || '',
      acosZeroBanner: (acosZero.banner || {}).t,
      acosOkText: String(acosOk.stats[0].v),
      restockZeroDaily: String(run('restock-planner', { stock: 100, daily: 0 }).stats[0].v),
      targetUnreachable: String(run('target-price', { goal: 'margin', target: 99, cost: 1000 }).stats[0].v),
      storageZeroSales: String(run('fba-storage', { units: 0, sales: 0 }).stats[1].v),
    };
  });
  // BUG-009: undefined ACOS must not render as a green 0.00%
  eq('BUG-009 ACOS with no ad sales is not 0%', c.acosZeroText, 'No ad sales');
  eq('BUG-009 ACOS with no ad sales is not coloured green', c.acosZeroTone, 'red');
  eq('BUG-009 a warning banner explains it', c.acosZeroBanner, 'warn');
  eq('ACOS still computes normally', c.acosOkText, '25.00%');
  /* Was '∞'. Zero recent sales does not prove infinite cover — it means the
     depletion rate cannot be established, so the tool must say unknown. */
  eq('restock: zero daily sales reports unknown, not infinite cover', c.restockZeroDaily, 'Not measurable');
  eq('target price: unreachable target says so', c.targetUnreachable, '—');
  eq('storage: zero sales gives no months-of-cover', c.storageZeroSales, '—');
}

if (useReal && fs.existsSync(REAL)) {
  console.log('\n== retest against the REAL files the defects were found on ==');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const files = walk(REAL).filter((f) => /\.(txt|csv)$/i.test(f) && !/allorders|traffic/i.test(f));
  for (const f of files) {
    const r = await analyse(fs.readFileSync(f, 'utf8'));
    const n = path.basename(f);
    eq(`${n}: reconciles to the deposit`, r.allSum, r.depositTotal);
    eq(`${n}: buckets sum to the deposit`, r.flowSum, r.depositTotal);
    eq(`${n}: every line classified — nothing unrecognised`, r.unknown, 0);
    if (r.balance !== 0 || r.ads !== 0)
      console.log(`         (fees ${r.fees}, ads ${r.ads}, balance ${r.balance})`);
  }
}

if (errors.length) { console.log('\nPAGE ERRORS:'); errors.forEach((e) => console.log('  ' + e)); }
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
