/**
 * Consistency sweep across every route: field labels, KPI labels, helper text,
 * empty states and validation copy. Looks for the same concept wearing
 * different names, and different concepts wearing the same one.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE='http://localhost:8899';
const b=await chromium.launch({channel:'chrome'});
const pg=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
const errs=[];
pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(BASE+'/',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1500);
const routes=await pg.evaluate(()=>{
  const out=new Set();
  document.querySelectorAll('a[href^="#/"],a[href^="/"]').forEach(a=>out.add(a.getAttribute('href').replace(/^#?\//,'')));
  if(window.CALCS) window.CALCS.forEach(c=>out.add('/'+c.id));
  return [...out];
});
const all=[];
for(const r of routes){
  await pg.goto(BASE+'/#'+r,{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(700);
  const d=await pg.evaluate(()=>({
    title:(document.querySelector('h1')||{}).innerText||'',
    labels:[...document.querySelectorAll('label')].map(e=>e.innerText.trim()).filter(Boolean),
    hints:[...document.querySelectorAll('.f-hint')].map(e=>e.innerText.trim()),
    kpis:[...document.querySelectorAll('.stat .k')].map(e=>e.innerText.trim()),
    ths:[...document.querySelectorAll('th')].map(e=>e.innerText.trim()).filter(Boolean),
  }));
  all.push({route:r,...d});
}
fs.writeFileSync('/tmp/consistency.json',JSON.stringify(all,null,1));
console.log('routes swept:',all.length,'pageErrors:',errs.length);
await b.close();
