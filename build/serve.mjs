/* Tiny static server for local review + Lighthouse. gzip/brotli like a real host. */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};
const compressible = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.xml', '.txt']);
const cache = new Map();

createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(root, path));
  const blocked = /(^|\/)(node_modules|build|src|partials|\.lighthouse|\.git)(\/|$)|package(-lock)?\.json$|products\.json$|AGENTS\.md$|\.zip$/;
  if (!file.startsWith(root) || blocked.test(path) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    return res.end('<!doctype html><title>Not found</title><h1>404</h1><p>Not built yet.</p>');
  }
  const ext = extname(file);
  const headers = { 'content-type': types[ext] || 'application/octet-stream' };
  headers['cache-control'] = ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable';
  let body = readFileSync(file);
  const ae = String(req.headers['accept-encoding'] || '');
  if (compressible.has(ext)) {
    headers.vary = 'Accept-Encoding';
    const enc = ae.includes('br') ? 'br' : ae.includes('gzip') ? 'gzip' : '';
    if (enc) {
      const key = `${file}:${statSync(file).mtimeMs}:${enc}`;
      if (!cache.has(key)) cache.set(key, enc === 'br' ? brotliCompressSync(body) : gzipSync(body));
      body = cache.get(key);
      headers['content-encoding'] = enc;
    }
  }
  headers['content-length'] = body.length;
  res.writeHead(200, headers);
  res.end(body);
}).listen(port, () => console.log(`ELECTRO preview → http://localhost:${port}/`));
