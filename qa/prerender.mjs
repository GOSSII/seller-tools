/**
 * Static pre-render for search engines and AI crawlers.
 *
 * The site is one 800 KB single-page app: Vercel rewrites every clean URL to
 * index.html and the router paints `<main id="app">` from JavaScript. That is
 * fine for people and *survivable* for Google (it renders JS in a deferred
 * second pass), but it is fatal for the AI crawlers — OAI-SearchBot,
 * ChatGPT-User, PerplexityBot, ClaudeBot — which do not run JavaScript at all.
 * They saw `<main id="app"></main>`: an empty page, on all 36 public URLs,
 * every one carrying the homepage's title and canonical.
 *
 * This script drives the REAL, unpatched app in a browser, snapshots what each
 * public route paints, and writes a static twin of index.html per route with
 * that HTML baked into `#app` plus the route's own title, description,
 * canonical and social tags. Vercel's filesystem check runs before the
 * catch-all rewrite, so /label-cropper now serves label-cropper.html; the SPA
 * boots on top and immediately replaces `#app`, so behaviour is unchanged.
 *
 *   node qa/prerender.mjs            # regenerate every route
 *   node qa/prerender.mjs --check    # CI: fail if the output is stale
 *
 * IMPORTANT: `web/index.html` stays the single source of truth and is never
 * hand-edited by this script beyond its own `#app` block. RE-RUN THIS AFTER
 * ANY CHANGE TO index.html, or the static twins serve yesterday's copy.
 * `node qa/prerender.mjs --check` exits non-zero when they have drifted — run
 * it before every deploy.
 *
 * Needs playwright-core and a system Chrome (see qa/README or the notes in
 * qa/responsive-audit.mjs for the scratchpad install trick).
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import url from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const ORIGIN = 'https://sellertoolsindia.com';
const CHECK = process.argv.includes('--check');
const PORT = 8907;

/* Public routes only. Auth and admin screens (login, signup, reset,
   new-password, account, admin, whoami) are deliberately absent: they are
   noindex by nature and must never be pre-rendered into a static file. */
const ROUTES = [
  '',
  'pricing', 'changelog',
  // calculators (CALCS)
  'profit', 'fba-fee', 'fba-storage', 'acos', 'break-even-acos', 'advertising-roi',
  'marketing-budget', 'launch-budget', 'coupon-roi', 'price-bands', 'target-price',
  'restock-planner',
  // free utilities
  'label-cropper', 'order-printer', 'fnsku-labels', 'gst-invoice', 'link-builder',
  'keyword-combiner', 'listing-checker', 'payout-forecast',
  // paid reports (the logged-out paywall view is what gets pre-rendered)
  'settlement-analyzer', 'gst-report', 'sku-report', 'sku-report/advanced',
  'reconcile', 'trends',
  'fee-bands', 'ads-optimizer', 'returns', 'storage', 'rto', 'stranded',
  'traffic', 'ad-profit',
];

/* Routes that are a variant of another page rather than a page of their own.
   /sku-report/advanced is the Pro deep link into the SKU report; logged out it
   renders the identical paywall to /sku-report, so it IS a duplicate and
   Google said so ("chose different canonical than user"). Pointing its
   canonical at the real page agrees with that instead of arguing, and keeps
   the route working for Pro users. Overridden routes stay out of the sitemap. */
const CANONICAL_OF = { 'sku-report/advanced': 'sku-report' };

const START = '<!--prerender:start-->';
const END = '<!--prerender:end-->';

/* ---------- a plain static server: no gatePremium patch, no banner ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.xml': 'application/xml',
  '.txt': 'text/plain', '.json': 'application/json' };

/* Every route is served from index.html, NEVER from a previously generated
   twin. Serving the twins would re-snapshot yesterday's output: the twin
   carries its own frozen copy of the inline script, so a change to
   index.html's render functions would be invisible here and the generator
   would cheerfully rewrite each file with stale content. Only real assets
   (images, xml, txt, css, js) come off disk. */
const ASSETS = new Set(['.png', '.svg', '.xml', '.txt', '.json', '.css', '.js', '.ico', '.webmanifest']);

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const ext = path.extname(p);
  let file = path.join(WEB, p);
  if (!file.startsWith(WEB)) return res.writeHead(403).end('no');
  if (!ASSETS.has(ext) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(WEB, 'index.html');
  }
  res.writeHead(200, { 'Content-Type': TYPES[ext] || 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(file));
});

/* ---------- head-tag surgery, idempotent so re-runs are stable ---------- */
const attrSet = (html, sel, attr, value) => {
  const re = new RegExp(`(<[^>]*${sel}[^>]*\\b${attr}=")[^"]*(")`, 'i');
  return re.test(html) ? html.replace(re, `$1${escapeAttr(value)}$2`) : html;
};
const escapeAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const escapeText = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* The template's JSON-LD describes the product as a whole, which is right on
   the homepage and wrong on a tool page. Every other route gets its own
   SoftwareApplication plus a breadcrumb, and the price comes from the paywall
   the page actually rendered rather than a list that could drift. */
function toolLd({ route, title, desc, body }) {
  const loc = `${ORIGIN}/${CANONICAL_OF[route] ?? route}`;
  const name = title.replace(/\s+—\s+Seller Tools India$/, '');
  const price = /Pro feature/.test(body) ? '499' : /Starter feature/.test(body) ? '199' : '0';
  return JSON.stringify([
    {
      '@context': 'https://schema.org', '@type': 'SoftwareApplication',
      name, applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
      description: desc, url: loc,
      offers: { '@type': 'Offer', price, priceCurrency: 'INR' },
      isPartOf: { '@type': 'WebApplication', name: 'Seller Tools India', url: `${ORIGIN}/` },
      publisher: { '@type': 'Organization', name: 'Seller Tools India', url: `${ORIGIN}/` },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Seller Tools India', item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name, item: loc },
      ],
    },
  ]);
}

function buildPage(template, { route, title, desc, body }) {
  const loc = `${ORIGIN}/${CANONICAL_OF[route] ?? route}`;
  let out = template;
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeText(title)}</title>`);
  out = attrSet(out, 'name="description"', 'content', desc);
  out = attrSet(out, 'rel="canonical"', 'href', loc);
  out = attrSet(out, 'property="og:title"', 'content', title);
  out = attrSet(out, 'property="og:description"', 'content', desc);
  out = attrSet(out, 'property="og:url"', 'content', loc);
  out = attrSet(out, 'name="twitter:title"', 'content', title);
  out = attrSet(out, 'name="twitter:description"', 'content', desc);
  if (route !== '') {
    out = out.replace(/(<script type="application\/ld\+json">)[\s\S]*?(<\/script>)/i,
      (_m, a, b) => a + toolLd({ route, title, desc, body }) + b);
  }
  out = out.replace(/<main id="app"[^>]*>[\s\S]*?<\/main>/i,
    `<main id="app">${START}${body}${END}</main>`);
  return out;
}

/* sitemap.xml is generated from the same route list, so a route can never be
   pre-rendered but unlisted (or listed but gone). Legal pages are extensionless
   here to match the canonical they declare. */
function writeSitemap() {
  const day = new Date().toISOString().slice(0, 10);
  const pri = r => (r === '' ? '1.0' : ['pricing', 'profit', 'label-cropper', 'settlement-analyzer'].includes(r) ? '0.9' : '0.7');
  const rows = [
    ...ROUTES.filter(r => !CANONICAL_OF[r]).map(r => `  <url><loc>${ORIGIN}/${r}</loc><lastmod>${day}</lastmod><priority>${pri(r)}</priority></url>`),
    ...['terms', 'privacy', 'refunds', 'contact'].map(
      r => `  <url><loc>${ORIGIN}/${r}</loc><lastmod>${day}</lastmod><priority>0.4</priority></url>`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
  const file = path.join(WEB, 'sitemap.xml');
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  // lastmod alone must not make --check fail; compare with the dates removed.
  const bare = s => s.replace(/<lastmod>[^<]*<\/lastmod>/g, '');
  if (bare(prev) === bare(xml)) return false;
  if (!CHECK) fs.writeFileSync(file, xml);
  return true;
}

/* Strip the pre-rendered block back out, so the template we clone from is the
   pristine SPA shell even when index.html already carries the homepage. */
const pristine = html => html
  .replace(/<main id="app"[^>]*>[\s\S]*?<\/main>/i, '<main id="app"></main>');

/* llms.txt — the convention AI answer engines look for: one markdown page that
   says what the site is and links every tool with a one-line description.
   Generated from the pages themselves so it cannot describe a tool we no
   longer ship. */
const LLMS_GROUPS = [
  ['Free calculators', ['profit', 'fba-fee', 'fba-storage', 'acos', 'break-even-acos',
    'advertising-roi', 'marketing-budget', 'launch-budget', 'coupon-roi', 'price-bands',
    'target-price', 'restock-planner']],
  ['Free tools (no login, files never leave the browser)', ['label-cropper', 'order-printer',
    'fnsku-labels', 'gst-invoice', 'link-builder', 'keyword-combiner', 'listing-checker',
    'payout-forecast']],
  ['Paid reports (Starter ₹199/month, Pro ₹499/month)', ['settlement-analyzer', 'gst-report',
    'sku-report', 'reconcile', 'trends', 'fee-bands', 'ads-optimizer', 'returns', 'storage',
    'rto', 'stranded', 'traffic', 'ad-profit']],
];

function writeLlms(meta) {
  const line = r => {
    const m = meta[r];
    return m ? `- [${m.title.replace(/\s+—\s+Seller Tools India$/, '')}](${ORIGIN}/${r}): ${m.desc}` : null;
  };
  const out = [
    '# Seller Tools India',
    '',
    '> Free calculators and paid analytics for Amazon India (Amazon.in) sellers. Every',
    '> uploaded file — settlement reports, order reports, label PDFs — is parsed in the',
    "> seller's own browser and never reaches a server.",
    '',
    'Marketplace: Amazon India only. Fees, GST and settlement formats are India-specific.',
    'Pricing: free tools need no account. Starter ₹199/month (or ₹999/year), Pro ₹499/month',
    '(or ₹2,499/year).',
    '',
    ...LLMS_GROUPS.flatMap(([heading, routes]) => [
      `## ${heading}`, '', ...routes.map(line).filter(Boolean), '',
    ]),
    '## About', '',
    `- [Pricing](${ORIGIN}/pricing): plans and what each one includes`,
    `- [What's new](${ORIGIN}/changelog): release notes`,
    `- [Privacy](${ORIGIN}/privacy): what is collected, and why uploaded files are not`,
    `- [Contact](${ORIGIN}/contact): support email`,
    '',
  ].join('\n');
  const file = path.join(WEB, 'llms.txt');
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (prev === out) return false;
  if (!CHECK) fs.writeFileSync(file, out);
  return true;
}

const run = async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const template = pristine(fs.readFileSync(path.join(WEB, 'index.html'), 'utf8'));
  const errors = [];
  const stale = [];
  const written = [];
  const meta = {};

  for (const route of ROUTES) {
    await page.goto(`http://localhost:${PORT}/${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const a = document.getElementById('app');
      return a && a.children.length > 0;
    }, { timeout: 15000 }).catch(() => errors.push(`${route || '/'}: #app never painted`));
    await page.waitForTimeout(350);

    const snap = await page.evaluate(() => {
      const app = document.getElementById('app').cloneNode(true);
      // Scripts and live counters must not be frozen into a static file.
      app.querySelectorAll('script,noscript').forEach(n => n.remove());
      app.querySelectorAll('[id="lc-odo"],[id="op-odo"]').forEach(n => n.setAttribute('hidden', ''));
      return {
        title: document.title,
        desc: (document.querySelector('meta[name="description"]') || {}).content || '',
        body: app.innerHTML,
      };
    });

    if (!snap.title || !snap.desc) errors.push(`${route || '/'}: missing title or description`);
    meta[route] = { title: snap.title, desc: snap.desc };

    const file = path.join(WEB, route === '' ? 'index.html' : `${route}.html`);
    fs.mkdirSync(path.dirname(file), { recursive: true });   // nested routes, e.g. sku-report/advanced
    const next = buildPage(template, { route, ...snap });
    const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (prev !== next) {
      if (CHECK) stale.push(route || '/');
      else { fs.writeFileSync(file, next); written.push(route || '/'); }
    }
    process.stdout.write(`  ${(route || '/').padEnd(22)} ${String(snap.body.length).padStart(7)} B  ${snap.title}\n`);
  }

  await browser.close();
  server.close();

  if (writeSitemap() && CHECK) stale.push('sitemap.xml');
  if (writeLlms(meta) && CHECK) stale.push('llms.txt');

  if (errors.length) { console.error('\nFAILED:\n' + errors.join('\n')); process.exit(1); }
  if (CHECK && stale.length) {
    console.error(`\nSTALE (${stale.length}): ${stale.join(', ')}\n  run: node qa/prerender.mjs`);
    process.exit(1);
  }
  console.log(CHECK ? '\nall pre-rendered pages current' : `\nwrote ${written.length} of ${ROUTES.length} pages`);
};

run();
