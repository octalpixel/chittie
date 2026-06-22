// SPIKE: prove the vendored ReceiptPrinterEncoder builds real ESC/POS bytes
// in our monorepo (codepage repointed to @angadie/chittie-codepage), and that
// the structuredClone shim makes it load.
import assert from 'node:assert/strict';
import ReceiptPrinterEncoder from '../src/index.js';

function contains(u8, seq) {
  const a = Array.from(u8);
  for (let i = 0; i + seq.length <= a.length; i++) {
    if (seq.every((b, j) => a[i + j] === b)) return true;
  }
  return false;
}
const ascii = (u8) =>
  Array.from(u8).map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '·')).join('');

const enc = new ReceiptPrinterEncoder({ columns: 32 });
const bytes = enc
  .initialize()
  .align('center')
  .bold(true)
  .line('Artisan Haus')
  .bold(false)
  .line('Kotte, Colombo')
  .rule()
  .align('left')
  .line('2 x Flat White      Rs. 1700')
  .line('1 x Croissant        Rs. 650')
  .rule()
  .align('center')
  .bold(true)
  .line('TOTAL    Rs. 2350')
  .bold(false)
  .newline()
  .pulse()
  .cut()
  .encode();

assert.ok(bytes instanceof Uint8Array, 'encode() returns Uint8Array');
assert.ok(bytes.length > 0, 'non-empty');
assert.ok(contains(bytes, [0x1b, 0x40]), 'ESC @ initialize present');
assert.ok(contains(bytes, [0x1b, 0x70]), 'ESC p cash-drawer pulse present');
assert.ok(contains(bytes, [0x1d, 0x56]), 'GS V cut present');
assert.ok(ascii(bytes).includes('Artisan Haus'), 'business name in bytes');
assert.ok(ascii(bytes).includes('TOTAL'), 'total line in bytes');

console.log('✓ chittie-core spike —', bytes.length, 'bytes');
console.log('  init=ESC@ ✓  drawer=ESC p ✓  cut=GS V ✓  text ✓');
