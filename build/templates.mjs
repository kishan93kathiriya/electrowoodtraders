/* Build-time HTML generators, driven entirely by products.json.
   Used by build/assemble.mjs through  <!-- @render name -->.
   Nothing here is typed by hand: names, counts, codes and MRP all come from the data,
   and nothing is rendered by client-side JS (AGENTS.md: static, crawlable markup). */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Listing thumbnails come from build/product-images.mjs: assets/img/products/<family-id>-{320,480}.webp, 8:5. */
const THUMB_WIDTHS = [320, 480];
const THUMB_RATIO = 1.6;
const thumbFile = (id, w) => fileURLToPath(new URL(`../assets/img/products/${id}-${w}.webp`, import.meta.url));

/** Catalogue order (what the tour walks through). `desc` is the one-line category summary,
 *  every clause of which is traceable to a family description in products.json. */
export const CATALOGUE = [
  { id: 'modular-switches-plates', short: 'Plates', desc: 'Holders, ring plates and switch plates in white, black, grey and metallic finishes.' },
  { id: 'concealed-surface-boxes', short: 'Boxes', desc: 'PVC and metal concealed boxes, surface gang boxes and junction boxes, half-module to 18-module.' },
  { id: 'wiring-accessories', short: 'Wiring', desc: 'Cable ties, wire clips, plug tops, connectors and drywall screws.' },
  { id: 'distribution-mcb-boxes', short: 'Distribution', desc: 'MCB, SPN and TPN distribution boxes, from 2-pole up to 16-way.' },
  { id: 'power-extension', short: 'Power', desc: 'Extension cords, flex boards and 4-step fan regulators.' },
  { id: 'lighting-doorbell', short: 'Lighting', desc: 'Decorative LED foot lights, night lamps and wired door bells.' },
];
/** Orbit order, nearest the bulb first. */
export const ORBIT_ORDER = ['lighting-doorbell', 'power-extension', 'distribution-mcb-boxes', 'wiring-accessories', 'concealed-surface-boxes', 'modular-switches-plates'];

const ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function createTemplates(data, { cfg } = {}) {
  const catById = Object.fromEntries(data.categories.map((c) => [c.id, c]));
  const famsOf = (cid) => data.families.filter((f) => f.category === cid);
  const skusOf = (cid) => famsOf(cid).reduce((a, f) => a + f.variants.length, 0);
  const total = { families: data.families.length, skus: data.families.reduce((a, f) => a + f.variants.length, 0) };

  /** de-dupes the two families that share a name ("5x5 & 7x7 Modular Holder Set" Black / Grey) */
  const displayName = (f) => (f.finish ? `${f.name} — ${f.finish}` : f.name);
  /** alt text is generated from the family name (+ series when the name doesn't already carry it) */
  const thumbAlt = (f) => {
    const n = displayName(f);
    return f.brand_series && !n.toLowerCase().includes(f.brand_series.toLowerCase()) ? `${f.brand_series} ${n}` : n;
  };
  /** responsive <img> for a family; `sizes` is the rendered width per breakpoint, `eager` for above-the-fold use */
  const thumbImg = (f, { cls, sizes, eager = false }) => {
    for (const w of THUMB_WIDTHS) if (!existsSync(thumbFile(f.id, w))) throw new Error(`missing thumbnail assets/img/products/${f.id}-${w}.webp — run: npm run images`);
    const set = THUMB_WIDTHS.map((w) => `/assets/img/products/${f.id}-${w}.webp ${w}w`).join(', ');
    const large = THUMB_WIDTHS[THUMB_WIDTHS.length - 1];
    return `<img${cls ? ` class="${cls}"` : ''} src="/assets/img/products/${f.id}-${large}.webp" srcset="${set}" sizes="${sizes}" width="${large}" height="${Math.round(large / THUMB_RATIO)}" alt="${esc(thumbAlt(f))}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
  };
  const mrps = (f) => f.variants.map((v) => v.mrp);
  const mrpRange = (f) => {
    const lo = Math.min(...mrps(f));
    const hi = Math.max(...mrps(f));
    return lo === hi ? inr.format(lo) : `${inr.format(lo)} – ${inr.format(hi)}`;
  };
  const finishes = (f) => {
    const set = new Set();
    if (f.finish) set.add(f.finish);
    (f.colors_available || []).forEach((c) => set.add(c));
    f.variants.forEach((v) => v.finish && set.add(v.finish));
    return [...set];
  };
  /** real product finish → one of the moon colours used by the 3D scene */
  const finishKey = (f) => {
    if (f.variants.some((v) => /GI|Zink/i.test(v.material || ''))) return 'metal';
    const raw = (f.finish || (f.colors_available && f.colors_available[0]) || (f.variants[0] && f.variants[0].finish) || '').toLowerCase();
    if (/glossy/.test(raw)) return 'gloss';
    if (/silver/.test(raw) || /silver/i.test(f.name)) return 'silver';
    if (/orange/.test(raw)) return 'orange';
    if (/black/.test(raw) || /black/i.test(f.name)) return 'black';
    if (/grey|gray/.test(raw)) return 'grey';
    return 'white';
  };

  /* ---- the six tour articles (catalogue order) ------------------------------- */
  function tourArticles() {
    return CATALOGUE.map((c, i) => {
      const cat = catById[c.id];
      const fams = famsOf(c.id);
      const first = fams
        .slice(0, 4)
        .map((f) => `<li><span class="tour__fam">${esc(displayName(f))}</span>${f.brand_series ? `<span class="tour__series">${esc(f.brand_series)}</span>` : ''}</li>`)
        .join('');
      return `<article class="tour__beat" id="range-${c.id}" data-beat="${i}" data-cat="${c.id}" aria-labelledby="range-${c.id}-h">
          <p class="tour__n"><span>0${i + 1}</span> / 06</p>
          <h3 class="tour__h" id="range-${c.id}-h">${esc(cat.name)}</h3>
          <p class="tour__desc">${esc(c.desc)}</p>
          <p class="tour__meta">${fams.length} ranges · ${skusOf(c.id)} products</p>
          <ul class="tour__fams">${first}</ul>
          <a class="tour__link" href="/${c.id}/">Explore the range ${ARROW}</a>
        </article>`;
    }).join('\n        ');
  }

  /* ---- the 35-family product index ------------------------------------------------ */
  function productIndex() {
    const chips = [
      `<button class="chip" type="button" aria-pressed="true" data-chip="all">All <span>${total.families}</span></button>`,
      ...CATALOGUE.map((c) => `<button class="chip" type="button" aria-pressed="false" data-chip="${c.id}">${esc(c.short)} <span>${famsOf(c.id).length}</span></button>`),
    ].join('\n            ');
    const cards = data.categories
      .flatMap((cat) => famsOf(cat.id))
      .map((f) => {
        const fin = finishes(f).slice(0, 4);
        const skus = f.variants.map((v) => v.sku);
        const names = [...new Set(f.variants.map((v) => v.name))].join(' ');
        const search = `${displayName(f)} ${f.brand_series || ''} ${catById[f.category].name} ${skus.join(' ')} ${names}`.toLowerCase();
        return `<li class="pcard" data-cat="${f.category}" data-search="${esc(search)}">
            ${thumbImg(f, { cls: 'pcard__img', sizes: '(min-width: 80rem) 20rem, (min-width: 64rem) 29vw, (min-width: 40rem) 44vw, 90vw' })}
            <a class="pcard__link" href="/${f.category}/${f.id}/"><h3 class="pcard__h">${esc(displayName(f))}</h3></a>
            <p class="pcard__cat">${f.brand_series ? `<span class="pcard__series">${esc(f.brand_series)}</span> · ` : ''}${esc(catById[f.category].name)}</p>
            ${fin.length ? `<ul class="pcard__fin" aria-label="Finishes">${fin.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
            <p class="pcard__stats"><span>${skus.length} codes</span><span>MRP ${mrpRange(f)}</span></p>
            <p class="pcard__skus">${skus.slice(0, 3).map((s) => `<code>${esc(s)}</code>`).join(' ')}</p>
          </li>`;
      })
      .join('\n          ');
    return `<div class="index__tools" data-index-tools>
          <div class="index__search">
            <label for="idx-q">Search by name or code</label>
            <input id="idx-q" type="search" autocomplete="off" spellcheck="false" placeholder="e.g. batten holder, E-603, VN55" data-index-q>
          </div>
          <div class="index__chips" role="group" aria-label="Filter by range">
            ${chips}
          </div>
        </div>
        <p class="sr-only" role="status" aria-live="polite" data-index-status></p>
        <ul class="index__grid" data-index-grid>
          ${cards}
        </ul>
        <p class="index__empty" data-index-empty hidden>No family matches that search. Try a code like <code>VN55</code> or a word like “holder”.</p>`;
  }

  /* ---- data the 3D scene reads (decoration only; the same facts exist as real HTML above) ---- */
  function orreryData() {
    const data3d = ORBIT_ORDER.map((id) => {
      const c = CATALOGUE.find((x) => x.id === id);
      return {
        id,
        name: catById[id].name,
        short: c.short,
        families: famsOf(id).length,
        skus: skusOf(id),
        href: `#range-${id}`,
        top: famsOf(id).slice(0, 3).map(displayName),
        moons: famsOf(id).map((f) => ({ id: f.id, finish: finishKey(f) })),
      };
    });
    return `<script type="application/json" id="orrery-data">${JSON.stringify(data3d)}</script>`;
  }

  /* ---- brands marquee: 1 real list + 3 aria-hidden copies for the seamless loop ---------------- */
  function marquee() {
    const list = (hidden) =>
      `<ul class="marquee__group"${hidden ? ' aria-hidden="true"' : ''}>${data.business.sub_brands.map((b) => `<li class="brand">${esc(b)}</li>`).join('')}</ul>`;
    return `<div class="marquee" data-marquee><div class="marquee__track">${list(false)}${list(true)}${list(true)}${list(true)}</div></div>`;
  }

  /* ---- manifesto: every word is a span so scroll can light it up -------------------------------- */
  function manifesto() {
    const lead = `In ${data.business.founded}, Electro began as a very small manufacturing unit in Ahmedabad. Today it makes ${total.skus} products across six ranges — the plates, boxes, wiring and boards behind the moment a room`;
    const words = lead.split(' ').map((w) => `<span class="w">${esc(w)}</span>`).join(' ');
    return `<p class="manifesto__p" data-manifesto>${words} <span class="burn"><span class="w">lights</span> <span class="w">up.</span></span></p>`;
  }

  return { tourArticles, productIndex, orreryData, marquee, manifesto, helpers: { displayName, mrpRange, finishKey, finishes, total, famsOf, skusOf, thumbImg, thumbAlt } };
}
