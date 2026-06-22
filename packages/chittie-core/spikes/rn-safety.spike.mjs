// SPIKE: are the image deps (@canvas/image-data, canvas-dither, canvas-flatten,
// resize-image-data) RN-safe? Two checks: (1) scan their source for Node/DOM
// hazards; (2) the decisive one — import chittie-core (which statically imports
// all of them + codepage) with Buffer nulled and no document/window, then encode.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);

const deps = ['@canvas/image-data', 'canvas-dither', 'canvas-flatten', 'resize-image-data'];
const HAZARD = /node:|require\(['"](?:fs|os|path|stream|buffer)['"]\)|\bBuffer\b|\bdocument\b|\bwindow\b|process\./g;

console.log('=== dep fields + entry-source hazard scan ===');
for (const d of deps) {
  const pj = JSON.parse(readFileSync(require.resolve(d + '/package.json'), 'utf8'));
  let entry;
  try {
    entry = require.resolve(d);
  } catch {
    const base = require.resolve(d + '/package.json').replace(/package\.json$/, '');
    entry = base + (pj.module || pj.main || 'index.js');
  }
  let hazards = [];
  try {
    hazards = [...new Set(readFileSync(entry, 'utf8').match(HAZARD) || [])];
  } catch {
    /* entry unreadable */
  }
  console.log(`  ${pj.name}@${pj.version} deps=${JSON.stringify(pj.dependencies || {})} rn=${pj['react-native'] || '-'} browser=${JSON.stringify(pj.browser || '-')}`);
  console.log(`     hazards: ${hazards.length ? hazards.join(', ') : 'none — pure JS ✓'}`);
}

console.log('\n=== RN-constraint import spike (Buffer=undefined, no document/window) ===');
assert.equal(typeof document, 'undefined', 'no DOM document (RN-like)');
assert.equal(typeof window, 'undefined', 'no window (RN-like)');
const savedBuffer = globalThis.Buffer;
// eslint-disable-next-line no-global-assign
globalThis.Buffer = undefined;
let bytes;
try {
  const { default: ReceiptPrinterEncoder } = await import('../src/index.js');
  bytes = new ReceiptPrinterEncoder({ columns: 32 })
    .initialize()
    .align('center')
    .line('Hello RN')
    .cut()
    .encode();
} finally {
  globalThis.Buffer = savedBuffer;
}
assert.ok(bytes instanceof Uint8Array && bytes.length > 0, 'encoded with Buffer/DOM absent');
console.log('  ✓ chittie-core imported + encoded', bytes.length, 'bytes with Buffer=undefined and no DOM');
console.log('  => the image deps + codepage load at import time WITHOUT Buffer/DOM → RN-safe import.');
console.log('     (image() rasterization still needs ImageData at runtime — documented, optional.)');
