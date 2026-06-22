// SPIKE: chittie-text — detection, raster routing (real image bytes via a fake
// injected rasterizer), and the no-silent-"?" safety net.
import assert from 'node:assert/strict';
import ReceiptPrinterEncoder from '@angadie/chittie-core';
import ImageData from '@canvas/image-data';
import { needsRaster, smartText, type TextRasterizer } from '../src/index.js';

function contains(u8: Uint8Array, seq: number[]): boolean {
  const a = Array.from(u8);
  for (let i = 0; i + seq.length <= a.length; i++) if (seq.every((b, j) => a[i + j] === b)) return true;
  return false;
}
const ascii = (u8: Uint8Array) =>
  Array.from(u8).map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '·')).join('');

// 1. detection
assert.equal(needsRaster('Hello Rs. 250'), false, 'Latin/digits are encodable');
assert.equal(needsRaster('ආයුබෝවන්'), true, 'Sinhala has no codepage');
assert.equal(needsRaster('මිල: Rs.250'), true, 'mixed Sinhala+Latin needs raster');

// 2. a fake rasterizer (the injection point) — returns a tiny ImageData
const fake: TextRasterizer = {
  rasterize(_text, _opts) {
    const w = 16;
    const h = 8;
    return new ImageData(new Uint8ClampedArray(w * h * 4), w, h) as unknown as ImageData;
  },
};

// Latin -> code-page text path
const e1 = new ReceiptPrinterEncoder({ columns: 32 });
e1.initialize();
smartText(e1 as never, 'Hello', {});
assert.ok(ascii(e1.encode()).includes('Hello'), 'Latin printed as text');

// Sinhala + rasterizer -> image path (GS v 0 raster = 1d 76 30)
const e2 = new ReceiptPrinterEncoder({ columns: 32 });
e2.initialize();
smartText(e2 as never, 'ආයුබෝවන්', { rasterizer: fake });
const b2 = e2.encode();
assert.ok(contains(b2, [0x1d, 0x76, 0x30]) || contains(b2, [0x1b, 0x2a]), 'image command emitted');

// Sinhala + NO rasterizer -> throws (no silent "?")
assert.throws(
  () => smartText(new ReceiptPrinterEncoder({ columns: 32 }) as never, 'ආයුබෝවන්', {}),
  /rasterizer/,
  'throws instead of printing ?'
);

console.log('✓ chittie-text spike — detect ✓ raster-route ✓ no-silent-? ✓');
