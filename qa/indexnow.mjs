/**
 * Submit every public URL to IndexNow — one POST that notifies Bing, Yandex,
 * Seznam and Naver at once. Bing's index is what several AI answer engines
 * (ChatGPT search among them) lean on, so this is the fastest route from
 * "deployed" to "discoverable" that does not require a console login.
 *
 * Google does NOT participate in IndexNow, and it retired its sitemap ping in
 * 2023 — the homepage and top tool pages still have to be submitted by hand in
 * Search Console (URL Inspection → Request indexing).
 *
 *   node qa/indexnow.mjs           # submit every URL in web/sitemap.xml
 *   node qa/indexnow.mjs --dry     # print what would be sent
 *
 * The key lives in web/<key>.txt and must already be deployed: IndexNow
 * fetches it to prove we control the host. Rotating it means writing a new
 * file, deploying, and updating KEY here.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const HOST = 'sellertoolsindia.com';
const KEY = '16befb00725f5cbeaf662379527cdf55';
const DRY = process.argv.includes('--dry');

const keyFile = path.join(WEB, `${KEY}.txt`);
if (!fs.existsSync(keyFile)) {
  console.error(`missing ${keyFile} — IndexNow will reject the submission`);
  process.exit(1);
}

const sitemap = fs.readFileSync(path.join(WEB, 'sitemap.xml'), 'utf8');
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
if (!urlList.length) { console.error('no URLs in sitemap.xml'); process.exit(1); }

const payload = { host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList };

console.log(`${urlList.length} URLs → api.indexnow.org`);
if (DRY) { console.log(JSON.stringify(payload, null, 2)); process.exit(0); }

// The key file has to be reachable before the endpoint will trust the batch.
const probe = await fetch(payload.keyLocation);
const probeBody = (await probe.text()).trim();
if (!probe.ok || probeBody !== KEY) {
  console.error(`key file not live yet at ${payload.keyLocation} (HTTP ${probe.status}, body "${probeBody.slice(0, 40)}")`);
  console.error('deploy first, then re-run.');
  process.exit(1);
}
console.log('key file verified live');

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});
// 200 = accepted, 202 = accepted, key validation pending. Both are success.
console.log(`IndexNow responded ${res.status} ${res.statusText}`);
const text = await res.text();
if (text.trim()) console.log(text.trim().slice(0, 500));
process.exit(res.status === 200 || res.status === 202 ? 0 : 1);
