#!/usr/bin/env node
/**
 * V61.3 Build pipeline for Промлизинг.
 *
 * Что делает:
 * 1. Чистит dist/.
 * 2. Копирует все нужные файлы в dist/.
 * 3. Минифицирует CSS через lightningcss.
 * 4. Минифицирует JS через esbuild.
 * 5. Минифицирует HTML через html-minifier-terser (JSON-LD сохраняется как есть).
 * 6. Создаёт .nojekyll (чтобы GH Pages не запускал Jekyll).
 *
 * Запуск: `npm run build`
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { transform as lightningTransform } from 'lightningcss';
import { minify as htmlMinify } from 'html-minifier-terser';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DIST = path.join(ROOT, 'dist');

// Что копировать. Папки и файлы относительно ROOT.
const COPY_DIRS = ['assets', 'docs', 'blog', 'seo', 'styles', 'scripts'];
const COPY_FILES = ['index.html', 'robots.txt', 'sitemap.xml', 'favicon.ico'];

// Что игнорировать при копировании всегда
const IGNORE = new Set([
  'node_modules', 'dist', '.git', '.github', '.claude',
  '.improvement', '.playwright-mcp', 'tmp', '_old_susanin',
  'package.json', 'package-lock.json',
  'build.mjs', // сам билдер не публикуем
  'admin', 'data', // PHP-админка и SQLite — только на REG.RU, в GH Pages не катятся
]);

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const stats = {
  htmlBefore: 0, htmlAfter: 0,
  cssBefore: 0, cssAfter: 0,
  jsBefore: 0, jsAfter: 0,
  copied: 0,
};

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (IGNORE.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

async function ensureDir(p) {
  await fs.mkdir(path.dirname(p), { recursive: true });
}

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

function distOf(srcAbs) {
  return path.join(DIST, path.relative(ROOT, srcAbs));
}

// ────────────────────────────────────────────────────────────────────────────
// Minifiers
// ────────────────────────────────────────────────────────────────────────────

async function processCss(srcAbs) {
  const src = await fs.readFile(srcAbs);
  stats.cssBefore += src.length;
  const out = lightningTransform({
    filename: rel(srcAbs),
    code: src,
    minify: true,
    sourceMap: false,
    targets: { chrome: 90 << 16, firefox: 90 << 16, safari: 14 << 16 },
  });
  if (out.warnings?.length) {
    for (const w of out.warnings) console.warn(`[css ${rel(srcAbs)}]`, w.type, w.value);
  }
  const dst = distOf(srcAbs);
  await ensureDir(dst);
  await fs.writeFile(dst, out.code);
  stats.cssAfter += out.code.length;
}

async function processJs(srcAbs) {
  const src = await fs.readFile(srcAbs, 'utf8');
  stats.jsBefore += Buffer.byteLength(src);
  const out = await esbuild.transform(src, {
    loader: 'js',
    minify: true,
    target: 'es2020',
    legalComments: 'none',
  });
  const dst = distOf(srcAbs);
  await ensureDir(dst);
  await fs.writeFile(dst, out.code);
  stats.jsAfter += Buffer.byteLength(out.code);
}

async function processHtml(srcAbs) {
  const src = await fs.readFile(srcAbs, 'utf8');
  stats.htmlBefore += Buffer.byteLength(src);
  let out;
  try {
    out = await htmlMinify(src, {
      collapseWhitespace: true,
      conservativeCollapse: false,
      removeComments: true,
      // removeRedundantAttributes: НЕ ставим true — он удаляет type="text" с <input>,
      // из-за чего ломаются CSS-селекторы input[type="text"]. Получаем поля без стилей,
      // с дефолтной браузерной рамкой 2px inset. Цена сохранения: ~50 байт на HTML.
      removeRedundantAttributes: false,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      minifyCSS: true,
      minifyJS: true,
      // JSON-LD не трогаем (processScripts не указан — application/ld+json игнорится)
      // SVG-фильтры внутри HTML тоже сохраняются — html-minifier-terser их не ломает.
    });
  } catch (e) {
    console.error(`[html ${rel(srcAbs)}] minify failed:`, e.message);
    out = src; // fallback — не минифицируем этот файл
  }
  const dst = distOf(srcAbs);
  await ensureDir(dst);
  await fs.writeFile(dst, out);
  stats.htmlAfter += Buffer.byteLength(out);
}

async function copyFile(srcAbs) {
  const src = await fs.readFile(srcAbs);
  const dst = distOf(srcAbs);
  await ensureDir(dst);
  await fs.writeFile(dst, src);
  stats.copied++;
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now();

  console.log('🧹 Cleaning dist/...');
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });

  // Собираем все исходники
  const sources = [];
  for (const f of COPY_FILES) {
    const abs = path.join(ROOT, f);
    if (await exists(abs)) sources.push(abs);
  }
  for (const d of COPY_DIRS) {
    const abs = path.join(ROOT, d);
    if (!(await exists(abs))) continue;
    for await (const f of walk(abs)) sources.push(f);
  }

  // Распределяем по типам
  const queue = { html: [], css: [], js: [], other: [] };
  for (const f of sources) {
    const ext = path.extname(f).toLowerCase();
    if (ext === '.html') queue.html.push(f);
    else if (ext === '.css') queue.css.push(f);
    else if (ext === '.js' || ext === '.mjs') queue.js.push(f);
    else queue.other.push(f);
  }

  console.log(`📦 Processing: ${queue.html.length} HTML, ${queue.css.length} CSS, ${queue.js.length} JS, ${queue.other.length} static`);

  // Параллельная обработка
  await Promise.all([
    ...queue.html.map(processHtml),
    ...queue.css.map(processCss),
    ...queue.js.map(processJs),
    ...queue.other.map(copyFile),
  ]);

  // .nojekyll — чтобы GH Pages не пытался Jekyll
  await fs.writeFile(path.join(DIST, '.nojekyll'), '');

  const dt = Date.now() - t0;
  const pct = (b, a) => b === 0 ? '0%' : `${((1 - a / b) * 100).toFixed(1)}%`;
  const kb = b => `${(b / 1024).toFixed(1)} KB`;

  console.log('');
  console.log('✅ Build complete in', dt, 'ms');
  console.log(`   HTML: ${kb(stats.htmlBefore)} → ${kb(stats.htmlAfter)} (-${pct(stats.htmlBefore, stats.htmlAfter)})`);
  console.log(`   CSS : ${kb(stats.cssBefore)} → ${kb(stats.cssAfter)} (-${pct(stats.cssBefore, stats.cssAfter)})`);
  console.log(`   JS  : ${kb(stats.jsBefore)} → ${kb(stats.jsAfter)} (-${pct(stats.jsBefore, stats.jsAfter)})`);
  console.log(`   Copied as-is: ${stats.copied} files`);
}

main().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
