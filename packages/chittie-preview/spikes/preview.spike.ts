// SPIKE: render a real chittie receipt (DEFAULT column image mode + a barcode +
// an auto-rasterized Sinhala line) through a mock canvas, and assert the parser
// drew clean text, image pixels, and a barcode box — i.e. it did NOT desync.
import assert from 'node:assert/strict';
import { ReceiptPrinterEncoder } from '@angadie/chittie';
import { smartText, type TextRasterizer } from '@angadie/chittie-text';
import ImageData from '@canvas/image-data';
import { renderReceipt, type PreviewContext2D } from '../src/index.js';

// a rasterizer that returns a small image with real black pixels
const rasterizer: TextRasterizer = {
  rasterize() {
    const w = 24;
    const h = 16;
    const data = new Uint8ClampedArray(w * h * 4).fill(255);
    for (let p = 0; p < w * h; p++) {
      const black = (p % 3 === 0) ? 0 : 255; // ~1/3 black
      data[p * 4] = black;
      data[p * 4 + 1] = black;
      data[p * 4 + 2] = black;
    }
    return new ImageData(data, w, h) as unknown as ImageData;
  },
};

const enc = new ReceiptPrinterEncoder({ columns: 32 }); // DEFAULT image mode = column (ESC *)
enc.initialize().align('center').bold(true).size(2, 2).line('Artisan Haus').size(1, 1).bold(false).align('center');
smartText(enc, 'ආයුබෝවන්!', { rasterizer });
enc.newline().align('left').rule();
enc.table([{ width: 22, align: 'left' }, { width: 10, align: 'right' }], [['Coffee', 'Rs. 850']]);
enc.barcode('012345678905', 'ean13', 60);
enc.rule().bold(true).table([{ width: 22, align: 'left' }, { width: 10, align: 'right' }], [['TOTAL', 'Rs. 850']]).bold(false);
enc.newline().align('center').line('Thank you!').cut();
const bytes = enc.encode();

// mock canvas that records what was drawn
const texts: string[] = [];
let rects = 0;
let strokes = 0;
const ctx: PreviewContext2D = {
  fillStyle: '',
  strokeStyle: '',
  font: '',
  textBaseline: '',
  fillRect: () => { rects++; },
  strokeRect: () => { strokes++; },
  fillText: (t) => { texts.push(t); },
  setLineDash: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {},
};
const canvas = renderReceipt(bytes, { createCanvas: (w, h) => ({ width: w, height: h, getContext: () => ctx }) });

const joined = texts.join(''); // spaces aren't drawn, so test space-agnostic tokens
assert.ok(canvas.height > 100, 'canvas sized to content');
assert.ok(joined.includes('Artisan') && joined.includes('Haus'), 'double-size header text');
assert.ok(joined.includes('Coffee') && joined.includes('850'), 'table row');
assert.ok(joined.includes('TOTAL'), 'TOTAL printed AFTER the barcode → parser did not desync');
assert.ok(joined.includes('Thank') && joined.includes('you'), 'footer');
assert.ok(texts.includes('barcode'), 'barcode placeholder box labelled');
assert.ok(rects > 50, `image pixels drawn (got ${rects})`);
assert.ok(strokes >= 1, 'barcode box stroked');

console.log('✓ chittie-preview spike — column-image + barcode + text rendered, no desync');
console.log(`  ${bytes.length} ESC/POS bytes → ${texts.length} glyphs, ${rects} image px, canvas ${canvas.width}x${canvas.height}`);
