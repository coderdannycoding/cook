// Zero-dependency static server for local play & testing.
//   node serve.mjs              → serves the source tree   (http://localhost:8080)
//   node serve.mjs --dir public → serves the production build (run `npm run build` first)
//   HOST=0.0.0.0 node serve.mjs → also reachable from other devices on your network (phone testing)
// It applies the same response headers as vercel.json (CSP, caching...) so what works here works in production.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)));
const dirArg = process.argv.indexOf('--dir');
const ROOT = resolve(HERE, dirArg > 0 ? process.argv[dirArg + 1] : '.');
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '127.0.0.1';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

// vercel.json "source" patterns are path-to-regexp; the simple ones used here are plain regex groups.
let headerRules = [];
try {
  const cfg = JSON.parse(await readFile(join(HERE, 'vercel.json'), 'utf8'));
  headerRules = (cfg.headers || []).map((r) => ({ re: new RegExp(`^${r.source}$`), headers: r.headers }));
} catch {
  headerRules = [];
}

createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = normalize(join(ROOT, url));
    // No dotfiles (.git, .env) and nothing outside the served folder
    if (url.split('/').some((seg) => seg.startsWith('.')) || (file !== ROOT && !file.startsWith(ROOT + sep))) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    const headers = { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' };
    for (const rule of headerRules) if (rule.re.test(url)) for (const h of rule.headers) headers[h.key] = h.value;
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}).listen(PORT, HOST, () => console.log(`Pandemonium Bistro → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}  (serving ${ROOT})`));
