/* Asserts every product count printed in the built index.html matches products.json.
   Run: npm run verify:counts   (exits 1 on any mismatch) */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'products.json'), 'utf8'));
const html = readFileSync(join(root, 'index.html'), 'utf8');

const rows = [];
let totalSkus = 0;
for (const c of data.categories) {
  const fams = data.families.filter((f) => f.category === c.id);
  const skus = fams.reduce((a, f) => a + f.variants.length, 0);
  totalSkus += skus;
  rows.push({ name: c.name, id: c.id, families: fams.length, skus });
}

let bad = 0;
const check = (label, ok) => { console.log(`${ok ? '  ok ' : ' FAIL'}  ${label}`); if (!ok) bad++; };

for (const r of rows) {
  check(`${r.name}: ${r.families} ranges · ${r.skus} products`, html.includes(`${r.families} ranges · ${r.skus} products`) && html.includes(`/${r.id}/`));
}
// ---- product index: every one of the families, with its own code count + MRP range ----------
const cards = html.split('<li class="pcard"').slice(1);   // split on the boundary: cards contain nested <li> finish chips
check(`index renders ${data.families.length} family cards (found ${cards.length})`, cards.length === data.families.length);
const num = (s) => Number(String(s).replace(/[₹,\s]/g, ''));
let cardBad = 0;
for (const f of data.families) {
  const card = cards.find((c) => c.includes(`href="/${f.category}/${f.id}/"`));
  const mrps = f.variants.map((v) => v.mrp);
  const lo = Math.min(...mrps), hi = Math.max(...mrps);
  const codes = card && (card.match(/<span>(\d+) codes<\/span>/) || [])[1];
  const mrp = card && (card.match(/<span>MRP ([^<]+)<\/span>/) || [])[1];
  const parts = mrp ? mrp.split('–').map(num) : [NaN];
  const ok = Number(codes) === f.variants.length && parts[0] === lo && (parts.length === 1 ? lo === hi : parts[1] === hi);
  if (!ok) { cardBad++; check(`  ${f.id}: expected ${f.variants.length} codes, MRP ${lo}–${hi}; card says ${codes} / ${mrp}`, false); }
}
check(`all ${data.families.length} cards: code count + MRP range match products.json`, cardBad === 0);
// ---- tour: six articles, orrery mirrors the same facts ------------------------------------------
check('tour has six range articles', (html.match(/<article class="tour__beat"/g) || []).length === 6);
for (const r of rows) check(`tour article for ${r.id}`, html.includes(`id="range-${r.id}"`));
const orrery = JSON.parse((html.match(/<script type="application\/json" id="orrery-data">([\s\S]*?)<\/script>/) || [])[1] || '[]');
check('orrery lists six planets', orrery.length === 6);
check(`orrery has ${data.families.length} moons (one per family)`, orrery.reduce((a, p) => a + p.moons.length, 0) === data.families.length);

check(`total: ${data.families.length} ranges`, html.includes(`>${data.families.length}<`) || html.includes(`data-count-to="${data.families.length}"`));
check(`total: ${totalSkus} products`, html.includes(`data-count-to="${totalSkus}"`));
check(`years: ${data.business.years_experience}`, html.includes(`data-count-to="${data.business.years_experience}"`));
check(`founded: ${data.business.founded}`, html.includes(String(data.business.founded)));
check(`ISO: ${data.business.certifications[0]}`, html.includes(data.business.certifications[0]));
check(`sub-brands: ${data.business.sub_brands.join(', ')}`, data.business.sub_brands.every((b) => html.includes(b)));

console.log(bad ? `\n${bad} mismatch(es)` : '\nall counts match products.json');
process.exit(bad ? 1 : 0);
