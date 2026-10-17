#!/usr/bin/env node
// Single-file build: the whole game (JS bundle, CSS, fonts) inlined into one HTML file.
// Useful for hosts that want one file (itch.io "HTML" uploads, offline sharing) and for
// embedding as a claude.ai Artifact page.
//
//   node scripts/build-single.mjs                 → dist/pandemonium-bistro.html (full document)
//   node scripts/build-single.mjs --artifact out  → also writes an Artifact page body to `out`
//
// Bundling uses esbuild, fetched on demand with `npx` (pinned version) — the regular `npm run build`
// and Vercel deploys don't need it.

import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'dist');
const ESBUILD = 'esbuild@0.24.0';
const CSS_FILES = ['styles/fonts.css', 'styles/main.css', 'styles/hud.css', 'styles/panels.css', 'styles/touch.css'];

function bundleJs() {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const out = execFileSync(npx, ['--yes', ESBUILD, join(ROOT, 'src/main.js'), '--bundle', '--format=esm', '--minify', '--target=es2020', '--legal-comments=none', '--log-level=warning'], {
    cwd: ROOT,
    maxBuffer: 64 * 1024 * 1024,
  });
  // Never let the inline script close itself early.
  const js = out.toString('utf8').replace(/<\/script/gi, '<\\/script');
  if (js.includes('<!--')) throw new Error('Bundle contains "<!--", which is unsafe inside an inline <script>; adjust the source.');
  return js;
}

async function inlineCss() {
  let css = '';
  for (const f of CSS_FILES) {
    let text = await readFile(join(ROOT, f), 'utf8');
    const base = dirname(join(ROOT, f));
    const urls = [...text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)];
    for (const m of urls) {
      const ref = m[1];
      if (/^(data:|https?:)/.test(ref)) continue;
      const data = await readFile(resolve(base, ref));
      const mime = ref.endsWith('.woff2') ? 'font/woff2' : ref.endsWith('.png') ? 'image/png' : 'application/octet-stream';
      text = text.replace(m[0], `url(data:${mime};base64,${data.toString('base64')})`);
    }
    css += `\n/* ${f} */\n${text}`;
  }
  return css.replace(/<\/style/gi, '<\\/style');
}

async function main() {
  const html = await readFile(join(ROOT, 'index.html'), 'utf8');
  const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'));
  const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
    .replace(/\s*<script type="module" src="src\/main\.js"><\/script>/, '');
  const metas = head.split('\n')
    .filter((l) => /<meta |<title>/.test(l) && !/charset|viewport/.test(l))
    .map((l) => l.trim())
    .join('\n');
  const [js, css] = [bundleJs(), await inlineCss()];

  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${metas}
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍳</text></svg>">
<style>${css}</style>
</head>
<body>
${body}
<script type="module">${js}</script>
</body>
</html>
`;
  await mkdir(OUT_DIR, { recursive: true });
  const outFile = join(OUT_DIR, 'pandemonium-bistro.html');
  await writeFile(outFile, page);
  console.log(`✔ dist/pandemonium-bistro.html (${(page.length / 1024).toFixed(0)} KB)`);

  // Artifact pages are wrapped in their own document skeleton: no doctype/html/head/body here.
  const ai = process.argv.indexOf('--artifact');
  if (ai > 0 && process.argv[ai + 1]) {
    const artifact = `<title>Pandemonium Bistro</title>
<meta name="description" content="A frantic isometric kitchen-chaos restaurant tycoon. Cook, serve, build and expand.">
<style>
html, body { height: 100%; }
${css}
</style>
${body}
<script type="module">${js}</script>
`;
    await writeFile(resolve(process.argv[ai + 1]), artifact);
    console.log(`✔ artifact page → ${process.argv[ai + 1]} (${(artifact.length / 1024).toFixed(0)} KB)`);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
