/**
 * Local preview of the audited build, so the paid tools can be clicked through
 * on your own machine with your own Amazon files.
 *
 *   node qa/local-preview.mjs           # serves on http://localhost:8899
 *   node qa/local-preview.mjs 9000      # or pick a port
 *
 * The ONLY thing changed is the entitlement check: `gatePremium(INFO, body)`
 * becomes `body()` in a temporary copy, because that check calls /api/entitlement
 * on the server and there is no server here. Every calculation, label and layout
 * is exactly what web/index.html contains. The shipped file is never modified.
 *
 * Stop with Ctrl-C. The preview lives in qa/out/preview/ (gitignored).
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const OUT = path.join(ROOT, 'qa/out/preview');
const PORT = Number(process.argv[2]) || 8899;

fs.mkdirSync(OUT, { recursive: true });

const build = () => {
  const src = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
  let patched = src.replace(/gatePremium\([^\n]*?,\s*([A-Za-z0-9_]+)\s*\);/g, '$1();');
  // NOBANNER=1 renders exactly what production renders — used for UI screenshots
  if (process.env.NOBANNER) return fs.writeFileSync(path.join(OUT, 'index.html'), patched), copyStatics();
  patched = patched.replace('<body>', `<body>
<div style="background:#fef3c7;border-bottom:1px solid #f59e0b;padding:8px 16px;
  font:600 13px/1.4 system-ui,sans-serif;color:#78350f;text-align:center">
  LOCAL PREVIEW of the audited build — paid tools unlocked for testing only.
  Not production. Production still serves the old build until you deploy.
</div>`);
  fs.writeFileSync(path.join(OUT, 'index.html'), patched);
  copyStatics();
};
function copyStatics() {
  for (const f of fs.readdirSync(WEB)) {
    const s = path.join(WEB, f);
    if (fs.statSync(s).isFile() && f !== 'index.html') fs.copyFileSync(s, path.join(OUT, f));
  }
}
build();

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain',
  '.json': 'application/json' };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  // rebuild on every page load, so editing web/index.html and refreshing just works
  if (p === '/index.html') build();
  let file = path.join(OUT, p);
  if (!file.startsWith(OUT)) { res.writeHead(403).end('no'); return; }
  if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
  if (!fs.existsSync(file)) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`\n  Audited build running at  http://localhost:${PORT}/`);
  console.log(`  Edit web/index.html and just refresh — it rebuilds per request.\n`);
  console.log('  Worth opening, with a settlement file from qa-data/raw/SELLER-A/settlements/:');
  console.log(`    http://localhost:${PORT}/#/settlement-analyzer   ← 54493020605.txt`);
  console.log(`    http://localhost:${PORT}/#/sku-report            ← 54493020605.txt`);
  console.log(`    http://localhost:${PORT}/#/trends                ← all six .txt at once`);
  console.log(`    http://localhost:${PORT}/#/rto                   ← qa-data/raw/SELLER-B/allorders/`);
  console.log(`    http://localhost:${PORT}/#/traffic               ← qa-data/raw/SELLER-A/traffic/`);
  console.log(`    http://localhost:${PORT}/#/acos                  ← set Ad Sales to 0`);
  console.log(`    http://localhost:${PORT}/#/payout-forecast       ← narrow the window to a phone width\n`);
});
