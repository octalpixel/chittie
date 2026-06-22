// Scan the image deps' ACTUAL installed source for browser-only globals/APIs
// that React Native (Hermes) does not provide. Reports every hit with context.
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);

// Globals present in browsers but NOT in RN/Hermes by default:
const BROWSER_ONLY = [
  'ImageData', 'OffscreenCanvas', 'createImageBitmap', 'ImageBitmap',
  'HTMLCanvasElement', 'HTMLImageElement', 'getContext', 'document', 'window',
  'self', 'navigator', 'atob', 'btoa', 'Blob', 'FileReader', 'requestAnimationFrame',
];
// These ARE in RN/Hermes (standard JS) — list so we can show they're the only globals used:
const RN_SAFE = ['Uint8ClampedArray', 'Uint8Array', 'Int32Array', 'Float32Array', 'Math.', 'Array', 'globalThis'];

function jsFiles(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory() && e !== 'node_modules') jsFiles(p, acc);
    else if (/\.(js|cjs|mjs)$/.test(e)) acc.push(p);
  }
  return acc;
}

for (const dep of ['@canvas/image-data', 'canvas-dither', 'canvas-flatten', 'resize-image-data']) {
  const pkgDir = dirname(require.resolve(dep + '/package.json'));
  const files = jsFiles(pkgDir);
  const browserHits = new Map();
  const safeHits = new Set();
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const tok of BROWSER_ONLY) {
      const re = new RegExp('\\b' + tok.replace('.', '\\.') + '\\b');
      if (re.test(src)) {
        const line = (src.split('\n').find((l) => re.test(l)) || '').trim().slice(0, 80);
        browserHits.set(tok, line);
      }
    }
    for (const tok of RN_SAFE) if (src.includes(tok)) safeHits.add(tok);
  }
  console.log(`\n${dep}  (${files.length} src file(s))`);
  console.log('  RN-safe globals used:', [...safeHits].join(', ') || '(none)');
  if (browserHits.size === 0) {
    console.log('  browser-only APIs: NONE ✓');
  } else {
    console.log('  browser-only APIs FOUND:');
    for (const [tok, line] of browserHits) console.log(`    ⚠ ${tok}:  ${line}`);
  }
}
