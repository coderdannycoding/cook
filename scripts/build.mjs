#!/usr/bin/env node
// Production build for static hosting (Vercel, Netlify, Cloudflare Pages, GitHub Pages, any web server).
//
// Zero dependencies: copies the playable files into public/ and verifies that every file referenced
// from HTML, JS imports and CSS url()s exists, so a broken reference fails the build instead of
// shipping a game that won't load. public/ is Vercel's default output folder for "Other" projects.

import { cp, rm, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public');
const SHIP = ['index.html', 'src', 'styles', 'vendor'];

const exists = async (p) => !!(await stat(p).catch(() => null));

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function main() {
  const started = Date.now();
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  for (const f of SHIP) await cp(join(ROOT, f), join(OUT, f), { recursive: true });

  // --- verify every local reference resolves -------------------------------------------
  const problems = [];
  const isRemote = (u) => /^(data:|blob:|https?:|\/\/|#|mailto:)/.test(u);
  const check = async (fromFile, ref) => {
    if (isRemote(ref)) return;
    const clean = ref.split(/[?#]/)[0];
    const target = clean.startsWith('/') ? join(OUT, clean) : resolve(dirname(fromFile), clean);
    if (!(await exists(target))) problems.push(`${relative(OUT, fromFile)} → ${ref}`);
  };

  const indexPath = join(OUT, 'index.html');
  let html = await readFile(indexPath, 'utf8');
  for (const m of html.matchAll(/\s(?:src|href)="([^"]+)"/g)) await check(indexPath, m[1]);

  const files = await walk(OUT);
  for (const file of files) {
    const ext = extname(file);
    if (ext === '.js' && file.includes(`${join(OUT, 'src')}`)) {
      const code = await readFile(file, 'utf8');
      // `import x from '...'`, `export ... from '...'` and side-effect `import '...'`
      for (const m of code.matchAll(/(?:\bfrom|\bimport)\s*['"]([^'"]+)['"]/g)) {
        if (!m[1].startsWith('.')) problems.push(`${relative(OUT, file)} → bare import "${m[1]}" (browsers can't resolve it without an import map)`);
        else await check(file, m[1]);
      }
      for (const m of code.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) await check(file, m[1]);
    }
    if (ext === '.css') {
      const css = await readFile(file, 'utf8');
      for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) await check(file, m[1]);
    }
  }
  if (problems.length) {
    console.error(`✖ Build failed — ${problems.length} broken reference(s):\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }

  // --- stamp the build ---------------------------------------------------------------------
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  const sha = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '').slice(0, 7);
  const version = sha ? `${pkg.version}+${sha}` : pkg.version;
  html = html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  <meta name="version" content="${version}">`);
  await writeFile(indexPath, html);

  let bytes = 0;
  for (const f of files) bytes += (await stat(f)).size;
  console.log(`✔ Built Pandemonium Bistro ${version} → public/ (${files.length} files, ${(bytes / 1024).toFixed(0)} KB) in ${Date.now() - started} ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
