/** Every claim surface for a tool, side by side, so drift between them is visible. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE='http://localhost:8899';
const b=await chromium.launch({channel:'chrome'});
const pg=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await pg.goto(BASE+'/',{waitUntil:'domcontentloaded'}); await pg.waitForTimeout(1500);
const tiles=await pg.evaluate(()=>{
  const o={};
  document.querySelectorAll('a[href^="#/"]').forEach(a=>{
    const h=a.querySelector('h3'), p=a.querySelector('p');
    if(h&&p) o[a.getAttribute('href').slice(2)]={tileTitle:h.innerText.trim(),tileDesc:p.innerText.trim()};
  });
  return o;
});
const out=[];
for(const r of Object.keys(tiles)){
  await pg.goto(BASE+'/#/'+r,{waitUntil:'domcontentloaded'}); await pg.waitForTimeout(600);
  const inTool=await pg.evaluate(()=>({
    h1:(document.querySelector('h1')||{}).innerText||'',
    lede:(document.querySelector('.lede,.sub')||{}).innerText||'',
    metaDesc:(document.querySelector('meta[name="description"]')||{}).content||'',
  }));
  out.push({route:r,...tiles[r],...inTool});
}
fs.writeFileSync('/tmp/claims-pairs.json',JSON.stringify(out,null,1));
console.log('tools compared:',out.length);
await b.close();
