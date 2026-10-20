/* Assembles static pages: src/**.html  ->  /**.html
   · <!-- @include partials/header.html -->     (recursive)
   · <!-- @if key --> ... <!-- @endif -->        (omit blocks whose value is empty)
   · {{var}} and {{count:<category-id>:families|skus}} / {{count:total:families|skus}}
   Counts are computed from products.json at build time so the numbers in the
   markup can never drift from the data (and nothing is rendered by JS).
   Zero dependencies. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTemplates } from './templates.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const cfg = JSON.parse(read('site.config.json'));
const data = JSON.parse(read('products.json'));
const templates = createTemplates(data, { cfg });

/* ---- data-derived counts ---------------------------------------------------- */
const counts = { total: { families: data.families.length, skus: 0 } };
for (const c of data.categories) counts[c.id] = { families: 0, skus: 0 };
for (const f of data.families) {
  counts[f.category].families += 1;
  counts[f.category].skus += f.variants.length;
  counts.total.skus += f.variants.length;
}

/* ---- cache-busting hashes --------------------------------------------------- */
const hash = (p) => (existsSync(join(root, p)) ? createHash('sha1').update(readFileSync(join(root, p))).digest('hex').slice(0, 8) : 'dev');

/* ---- enquiry links (only what the sources actually provide) ----------------- */
const email = cfg.email || data.business.email;
const mail = (subject, body) => `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
const digits = String(cfg.whatsappNumber || '').replace(/\D/g, '');

const ctx = {
  year: String(new Date().getFullYear()),
  siteUrl: cfg.siteUrl.replace(/\/$/, ''),
  email,
  website: data.business.website,
  founder: data.business.founder,
  founded: String(data.business.founded),
  years: String(data.business.years_experience),
  iso: data.business.certifications[0],
  quoteHref: mail('Request a quote — ELECTRO', 'Hello ELECTRO,\n\nI would like a quote for:\n\nProduct / code:\nQuantity:\nCity:\n\nThank you.'),
  dealerHref: mail('Dealer enquiry — ELECTRO', 'Hello ELECTRO,\n\nI would like to become a dealer.\n\nName:\nBusiness:\nCity:\nPhone:\n\nThank you.'),
  whatsappHref: digits ? `https://wa.me/${digits}?text=${encodeURIComponent('Hello ELECTRO, I would like to enquire about your range.')}` : '',
  phone: cfg.phone || '',
  phoneHref: cfg.phone ? `tel:${String(cfg.phone).replace(/[^\d+]/g, '')}` : '',
  catalogueUrl: cfg.catalogueUrl || '',
  cssV: hash('assets/css/site.css'),
  navV: hash('assets/js/dist/nav.js'),
  homeV: hash('assets/js/dist/home.js'),
  heroV: hash('assets/js/dist/hero-three.js'),
};

function render(str, depth = 0) {
  if (depth > 6) throw new Error('include depth exceeded');
  // includes live in src/partials/ (the repo root's partials/ belongs to the hand-authored static pages)
  str = str.replace(/<!--\s*@include\s+([\w./-]+)\s*-->/g, (_, f) => render(read('src/' + f), depth + 1));
  str = str.replace(/<!--\s*@render\s+(\w+)\s*-->/g, (m, name) => {
    if (typeof templates[name] !== 'function') throw new Error(`unknown template in ${m}`);
    return templates[name]();
  });
  str = str.replace(/<!--\s*@if\s+(\w+)\s*-->([\s\S]*?)<!--\s*@endif\s*-->/g, (_, k, body) => (ctx[k] ? body : ''));
  str = str.replace(/\{\{\s*count:([\w-]+):(families|skus)\s*\}\}/g, (m, id, k) => {
    if (!counts[id]) throw new Error(`unknown category in ${m}`);
    return String(counts[id][k]);
  });
  str = str.replace(/\{\{\s*([\w]+)\s*\}\}/g, (m, k) => {
    if (!(k in ctx)) throw new Error(`unknown variable ${m}`);
    return ctx[k];
  });
  return str;
}

function* pages(dir) {
  for (const name of readdirSync(join(root, dir))) {
    const p = join(dir, name);
    if (statSync(join(root, p)).isDirectory()) { if (name !== 'partials') yield* pages(p); }   // partials are includes, never pages
    else if (name.endsWith('.html')) yield p;
  }
}

let n = 0;
const urls = [];
for (const src of pages('src')) {
  const out = relative('src', src);
  // Asset URLs are emitted relative to the page's depth, so a page renders correctly from a
  // static host AND when opened straight from disk. (Page-to-page links stay root-relative.)
  const prefix = '../'.repeat(out.split('/').length - 1);
  const html = render(read(src)).replace(/(["',\s(])\/assets\//g, `$1${prefix}assets/`);
  mkdirSync(dirname(join(root, out)), { recursive: true });
  writeFileSync(join(root, out), html);
  console.log(`  ${src}  ->  ${out}  (${(html.length / 1024).toFixed(1)} KB)`);
  urls.push(out === 'index.html' ? '/' : out.endsWith('/index.html') ? '/' + out.slice(0, -'index.html'.length) : '/' + out);
  n++;
}

/* sitemap.xml + robots.txt come from EVERY page that exists on disk — the ones built from src/ AND the
   hand-authored static pages (categories, families, about, contact) — so the sitemap can neither
   advertise a 404 nor drop a page. Entries already in sitemap.xml keep their lastmod/changefreq/priority;
   pages rebuilt in this run get today's date; brand-new pages get sensible defaults. */
const today = new Date().toISOString().slice(0, 10);
const NOT_PAGES = new Set(['node_modules', 'src', 'build', 'partials', 'uploads', '_ds', 'assets']);
function* htmlOnDisk(dir = '') {
  for (const name of readdirSync(join(root, dir))) {
    if (NOT_PAGES.has(name) || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(join(root, p)).isDirectory()) yield* htmlOnDisk(p);
    else if (name.endsWith('.html')) yield p;
  }
}
const urlOf = (p) => (p === 'index.html' ? '/' : p.endsWith('/index.html') ? '/' + p.slice(0, -'index.html'.length) : '/' + p);
const prior = new Map();
if (existsSync(join(root, 'sitemap.xml'))) {
  for (const m of read('sitemap.xml').matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]*)<\/lastmod>)?(?:\s*<changefreq>([^<]*)<\/changefreq>)?(?:\s*<priority>([^<]*)<\/priority>)?/g)) {
    prior.set(m[1], { lastmod: m[2], changefreq: m[3], priority: m[4] });
  }
}
const defaultPriority = (u) => (u === '/' ? '1.0' : /^\/[^/]+\.html$/.test(u) ? '0.6' : /^\/[^/]+\/$/.test(u) ? '0.9' : '0.7');
const pageUrls = [...new Set([...htmlOnDisk()].map(urlOf))].sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
writeFileSync(
  join(root, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    pageUrls
      .map((u) => {
        const was = prior.get(ctx.siteUrl + u) || {};
        const lastmod = urls.includes(u) ? today : was.lastmod || today;
        return `  <url>\n    <loc>${ctx.siteUrl}${u}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${was.changefreq || 'monthly'}</changefreq>\n    <priority>${was.priority || defaultPriority(u)}</priority>\n  </url>`;
      })
      .join('\n') +
    `\n</urlset>\n`
);
writeFileSync(join(root, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${ctx.siteUrl}/sitemap.xml\n`);

const omitted = [
  !ctx.whatsappHref && 'WhatsApp CTA (set whatsappNumber in site.config.json)',
  !ctx.phone && 'tel: link (set phone in site.config.json)',
  !ctx.catalogueUrl && 'Download Catalogue CTA (set catalogueUrl in site.config.json)',
].filter(Boolean);
console.log(`assembled ${n} page(s)`);
if (omitted.length) console.log('  omitted until the business supplies them:\n   - ' + omitted.join('\n   - '));
