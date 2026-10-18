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
    close799: closingFee(799, 'easyship', 'home-kitchen'),
    close799fba: closingFee(799, 'fba', 'home-kitchen'),
    prevEasyShip: JSON.stringify(CLOSING_PREV.easyship),
    selfUnchanged: JSON.stringify(CLOSING_BY_CHANNEL.self),
    es04: esWeightHandling(0.4, 'standard'),
    es09: esWeightHandling(0.9, 'standard'),
    es19: esWeightHandling(1.9, 'standard'),
    ref399: refRate('home-kitchen', 399),
    ref1500: refRate('home-kitchen', 1500),
    settle499: (function () {
      const c = CALCS.find((x) => x.id === 'profit');
      // gstreg 'no': the "proceeds after Amazon fees" card is GST-neutral either way
      const v = { sp: 499, cost: 0, cat: 'home-kitchen', kg: 0.9, L: 1, W: 1, H: 1,
        ful: 'easyship', zone: 'local', pack: 0, acos: 0, ret: 0, gstreg: 'no' };
      const r = c.compute(v);
      return Number(String(r.stats[0].v).replace(/[^0-9.]/g, ''));
    })(),
  }));
  /* From 7 Sep 2026 Amazon added Rs 1 (up to Rs 500) / Rs 3 (above) on Easy
     Ship, Seller Flex and FBA. Observed on a real account: Rs 449 charged 23,
     Rs 149 charged 2, Rs 799 charged 48 — where the same items paid 22 / 1 / 45
     before the change. The earlier card stays as CLOSING_PREV. */
  eq('closing fee at Rs 399 (Rs 23 since 7 Sep 2026)', fe.close399, 23);
  eq('closing fee at Rs 499 (Rs 23 since 7 Sep 2026)', fe.close499, 23);
  eq('closing fee at Rs 250 (Rs 2 since 7 Sep 2026)', fe.close250, 2);
  eq('closing fee at Rs 799 (Amazon charged Rs 48.00)', fe.close799, 48);
  eq('closing fee above Rs 1,000 (76 + 3)', fe.close1500, 79);
  eq('FBA closing fee at Rs 799 (27 + 3)', fe.close799fba, 30);
  eq('the 10 June card is kept for older statements', fe.prevEasyShip, '[1,22,45,76]');
  eq('Self Ship was not part of the 7 Sep change', fe.selfUnchanged, '[20,26,51,101]');
  eq('Easy Ship 0.4 kg (Amazon charged Rs 55.00)', fe.es04, 55);
  eq('Easy Ship 0.9 kg (Amazon charged Rs 75.00)', fe.es09, 75);
  eq('Easy Ship 1.9 kg', fe.es19, 112);
  eq('referral 0% below Rs 1,000 (no referral line in the real settlement)', fe.ref399, 0);
  eq('referral above Rs 1,000', fe.ref1500, 0.125);
  // Amazon paid Rs 384.54 on this order under the Rs 22 closing fee; Rs 23 now.
  eq('profit calc settlement for a Rs 499 Easy Ship order (Rs 384.54 before 7 Sep, 383.36 now)', fe.settle499, 383.36);
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
      /* PRIV-1. clearToolData() is built at call time because the key
         constants live further down the file; a top-level array hit the
         temporal dead zone and killed the whole script on load. Assert it
         both RUNS and actually removes the sensitive keys. */
      privClear: (() => {
        localStorage.setItem('gstinv_seller', JSON.stringify({ gstin: '27ABCDE1234F1Z5' }));
        localStorage.setItem('sku_costs', JSON.stringify({ A: 1 }));
        const removed = clearToolData();
        const left = ['gstinv_seller', 'sku_costs'].filter(k => localStorage.getItem(k) !== null);
        return removed >= 2 && left.length === 0 ? 'cleared' : 'LEFT:' + left.join(',');
      })(),
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
  eq('PRIV-1 clearToolData removes saved GSTIN and product costs', c.privClear, 'cleared');
  eq('target price: unreachable target says so', c.targetUnreachable, '—');
  eq('storage: zero sales gives no months-of-cover', c.storageZeroSales, '—');
}

console.log('\n== fixes from the 18 Oct 2026 real-account audit ==');
{
  const fx = fs.readFileSync(path.join(FIX, 'settlement-safet-shipping.txt'), 'utf8');
  const a = await page.evaluate((t) => {
    const p = window.parseSettlement(t);
    const agg = window.saAggregate(p);
    const flow = window.saFlow(p.records);
    const kinds = {};
    for (const rec of p.records) for (const l of rec.amounts) kinds[l.amountDescription] = window.saLineKind(l, rec.transactionType);
    const rec = window.recCompute([p], [], {});
    const sku = window.skuCompute(p).find((s) => s.sku === 'TEST-BP');
    const calc = (id, v) => { const c = CALCS.find((x) => x.id === id); const d = {}; c.fields.forEach((f) => (d[f.k] = f.d)); return c.compute(Object.assign(d, v)); };
    const num = (s) => Number(String(s).replace(/[^0-9.-]/g, ''));
    const prof = calc('profit', { sp: 799, cost: 358, cat: 'personal-care', kg: 0.3, L: 15, W: 10, H: 8, pack: 0, acos: 0, retcost: 0, stmon: 0, ful: 'easyship', zone: 'national', gstreg: 'yes', gstrate: '18' });
    const profNo = calc('profit', { sp: 799, cost: 358, cat: 'personal-care', kg: 0.3, L: 15, W: 10, H: 8, pack: 0, acos: 0, retcost: 0, stmon: 0, ful: 'easyship', zone: 'national', gstreg: 'no' });
    const be = calc('break-even-acos', { price: 799, cost: 358, fees: 121.54, cvr: 6.4, target: 15, gstrate: '18' });
    const terms = [
      { camp: 'c', group: 'g', term: 'fidget toys adults', match: 'AUTO', orders: 0, clicks: 47, spend: 86.47, sales: 0, impressions: 900 },
      { camp: 'c', group: 'g', term: 'bitronix belly fat burner machine', match: 'PHRASE', orders: 0, clicks: 6, spend: 113.63, sales: 0, impressions: 300 },
      { camp: 'c', group: 'g', term: 'thin term', match: 'AUTO', orders: 0, clicks: 3, spend: 20, sales: 0, impressions: 90 },
      { camp: 'c', group: 'g', term: 'winner', match: 'AUTO', orders: 3, clicks: 30, spend: 60, sales: 900, impressions: 800 },
    ];
    const ads = window.adsCompute(terms, {});
    const fh = document.createElement('div'); fh.innerHTML = fieldHtml({ k: 'spend', label: 'Ad Spend (₹)', t: 'num', d: 0 }, 0);
    return {
      allSum: +agg.allSum.toFixed(2), deposit: p.summary.totalAmount, unknown: +agg.unknown.toFixed(2),
      kCancel: kinds['Order Cancellation Charge'], kInbound: kinds['FBAInboundTransportationFee'],
      kFeeAdj: kinds['Fee Adjustment'], kShip: kinds['Shipping'],
      gross: +flow.B.gross.toFixed(2), shipPaid: +flow.B.shipPaid.toFixed(2),
      amazonFees: +agg.amazonFees.toFixed(2), promo: +agg.promo.toFixed(2),
      safetOrders: rec.issues.safeT.map((x) => x.orderId).join(','), safetPaid: rec.notes.safeTPaidN,
      skuSales: +sku.sales.toFixed(2), skuTaxes: +sku.taxes.toFixed(2),
      profitAfterGst: num(prof.stats[1].v), profitNoGst: num(profNo.stats[1].v),
      beAcos: num(be.stats[0].v),
      negate: ads.negate.map((x) => x.term).sort().join('|'), noOrderSpend: +ads.noOrderSpend.toFixed(2),
      ceilEasyShip: recClosingCeiling(799, false, true), ceilMfn: recClosingCeiling(799, false, false), ceilFba: recClosingCeiling(799, true),
      rtBadDesc: rtBucketOf('AMZ-PG-BAD-DESC'), rtTooSmall: rtBucketOf('AMZ-PG-APP-TOO-SMALL'),
      decRupee: fh.querySelector('input').dataset.dec,
      capsBrand: lqcAllCaps('RAAGOS Digital Wrist BP Monitor', true).join(','),
      capsLoud: lqcAllCaps('RAAGOS BEST Monitor', true).join(','),
    };
  }, fx);
  eq('fixture reconciles to its deposit', a.allSum, a.deposit);
  eq('Order Cancellation Charge is a fee, not unrecognised', a.kCancel, 'fee');
  eq('FBAInboundTransportationFee is a fee (written as one word)', a.kInbound, 'fee');
  eq('Fee Adjustment is a fee line (its sign does not decide)', a.kFeeAdj, 'fee');
  eq('buyer-paid Shipping is order money, not unrecognised', a.kShip, 'principal');
  eq('nothing in the fixture is left unrecognised', a.unknown, 0);
  eq('buyer shipping stays out of gross product sales', a.gross, 803.39);
  eq('buyer shipping shows on its own line (paid, then refunded)', a.shipPaid, 0);
  eq('Amazon fees exclude nothing that is not a fee', a.promo, 0);
  eq('SAFE-T: an order Amazon already reimbursed is not a case to file', a.safetOrders, '171-0000000-0000002');
  eq('SAFE-T: the reimbursed order is counted as excluded', a.safetPaid, 1);
  eq('SKU sales exclude buyer shipping', a.skuSales, 677.12);
  eq('profit calc: ₹799 BP Monitor after GST (real settlement: 677.12 − 103 − 358)', a.profitAfterGst, 216.12);
  eq('profit calc: not GST-registered keeps the old basis', a.profitNoGst, 319.46);
  eq('break-even ACOS after GST for the ₹799 BP Monitor', a.beAcos, 27.05);
  eq('ads optimizer: 10+ clicks OR ₹100+ spend with no order is a negate', a.negate, 'bitronix belly fat burner machine|fidget toys adults');
  eq('ads optimizer: every rupee on zero-order terms is reported', a.noOrderSpend, 220.1);
  eq('fee check: Easy Ship ₹799 ceiling is the Easy Ship fee', a.ceilEasyShip, 48);
  eq('fee check: unknown MFN channel keeps the dearer Self Ship ceiling', a.ceilMfn, 51);
  eq('fee check: FBA ceiling on the new card', a.ceilFba, 30);
  eq('returns: AMZ-PG-BAD-DESC is a listing problem', a.rtBadDesc, 'listing');
  eq('returns: AMZ-PG-APP-TOO-SMALL is a listing problem', a.rtTooSmall, 'listing');
  eq('a ₹ field accepts a decimal point', a.decRupee, '1');
  eq('listing checker: a brand in capitals is not an ALL-CAPS fault', a.capsBrand, '');
  eq('listing checker: other ALL-CAPS words are still caught', a.capsLoud, 'BEST');
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
