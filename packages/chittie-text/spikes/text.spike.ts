// SPIKE: chittie-text — detection, raster routing (real image bytes via a fake
// injected rasterizer), and the no-silent-"?" safety net.
import assert from 'node:assert/strict';
import ReceiptPrinterEncoder from '@angadie/chittie-core';
import ImageData from '@canvas/image-data';
import { needsRaster, smartText, rasterizeRow, foldTypographic, sanitizeControl, formatMoney, type TextRasterizer } from '../src/index.js';

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
  // deliberately NOT multiples of 8 — proves smartText pads to ESC/POS raster dims
  rasterize(_text, _opts) {
    const w = 13;
    const h = 7;
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

// rasterizeRow: left + right → one printer-width image, dims padded to /8
const rowImg = rasterizeRow(fake, 'නම', 'Rs. 250', { dotWidth: 384 });
assert.equal(rowImg.width, 384, 'row image spans the printer dot width');
assert.ok(rowImg.width % 8 === 0 && rowImg.height % 8 === 0, 'row image padded to multiples of 8');
assert.equal(rowImg.data.length, rowImg.width * rowImg.height * 4, 'row image data is well-formed');

// foldTypographic: common punctuation that cp437 lacks → ASCII (× → x, … → ..., etc.)
assert.equal(foldTypographic('2× Coffee'), '2x Coffee', '× folds to x');
assert.equal(foldTypographic('A — B “c” … •'), 'A - B "c" ... *', 'dash/quotes/ellipsis/bullet fold');
assert.equal(needsRaster('2× Coffee'), true, '× is unencodable on cp437 (raw)');
assert.equal(needsRaster(foldTypographic('2× Coffee')), false, 'folded form is encodable — no raster/throw');
// smartText folds first, so "2× Coffee" prints as text without a rasterizer (no throw)
const e3 = new ReceiptPrinterEncoder({ columns: 32 });
e3.initialize();
smartText(e3 as never, '2× Coffee', {});
assert.ok(ascii(e3.encode()).includes('2x Coffee'), 'smartText folds × → x and prints as text');

// sanitizeControl: strip injected control bytes (ESC/GS) from user text
assert.equal(sanitizeControl('ABC'), 'ABC', 'C0 + DEL stripped (no injection)');
// smartText sanitizes before encoding — a name with a raw ESC prints clean
const e4 = new ReceiptPrinterEncoder({ columns: 32 });
e4.initialize();
smartText(e4 as never, 'MugX', {});
assert.ok(ascii(e4.encode()).includes('MugX'), 'smartText strips control bytes from text');

// formatMoney: RN-safe (no Intl). Prove grouping holds with Intl nulled (Hermes has none).
const savedIntl = (globalThis as Record<string, unknown>).Intl;
(globalThis as Record<string, unknown>).Intl = undefined;
try {
  assert.equal(formatMoney(1700, { currency: 'Rs.', decimals: 0 }), 'Rs. 1,700', 'LKR whole-rupee grouped');
  assert.equal(formatMoney(1234567.5, { decimals: 2 }), '1,234,567.50', 'grouping + decimals, no Intl');
  assert.equal(formatMoney(-250.5, { currency: '$' }), '-$ 250.50', 'refund (negative) gets leading -');
  assert.equal(formatMoney(50, { currency: 'LKR', position: 'suffix' }), '50.00 LKR', 'suffix currency');
} finally {
  (globalThis as Record<string, unknown>).Intl = savedIntl;
}

console.log('✓ chittie-text spike — detect ✓ raster ✓ no-silent-? ✓ rasterizeRow ✓ fold ✓ sanitize ✓ formatMoney(no-Intl) ✓');
