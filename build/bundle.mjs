/* Bundles the plain-JS sources into self-contained ES modules in assets/js/dist/.
   nav.js and home.js are tiny and load on the critical path; hero-three.js
   (which contains the tree-shaken Three.js) is imported lazily by home.js. */
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entries = ['nav', 'home', 'hero-three'];

await build({
  entryPoints: entries.map((e) => join(root, `assets/js/${e}.js`)),
  outdir: join(root, 'assets/js/dist'),
  bundle: true,
  format: 'esm',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  treeShaking: true,
  logLevel: 'warning',
});

for (const e of entries) {
  const buf = readFileSync(join(root, `assets/js/dist/${e}.js`));
  console.log(`  dist/${e}.js  ${(buf.length / 1024).toFixed(1)} KB  (${(gzipSync(buf).length / 1024).toFixed(1)} KB gzip)`);
}
