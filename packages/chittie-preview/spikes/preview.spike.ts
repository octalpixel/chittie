// SPIKE: render a real chittie receipt (DEFAULT column image mode + a barcode +
// an auto-rasterized Sinhala line) through a mock canvas, and assert the parser
// drew clean text, image pixels, and a barcode box — i.e. it did NOT desync.
import assert from 'node:assert/strict';
import { ReceiptPrinterEncoder } from '@angadie/chittie';
import { smartText, type TextRasterizer } from '@angadie/chittie-text';
import ImageData from '@canvas/image-data';
import { label, LABEL_PROFILES } from '@angadie/chittie-label';
import { renderReceipt, renderLabel, type PreviewContext2D } from '../src/index.js';

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
enc.newline().align('center').line('Thank you!').font('B').line('Powered by chittie').font('A').cut();
const bytes = enc.encode();

// mock canvas that records what was drawn
const texts: string[] = [];
const fonts: string[] = [];
let rects = 0;
let strokes = 0;
const ctx: PreviewContext2D = {
  fillStyle: '',
  strokeStyle: '',
  font: '',
  textBaseline: '',
  fillRect: () => { rects++; },
  strokeRect: () => { strokes++; },
  fillText: (t) => { texts.push(t); fonts.push(ctx.font); },
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
// Font B (<Text small> → ESC M 1) renders smaller than Font A's 18px in the preview
const pxOf = (f: string) => { const m = f.match(/(\d+(?:\.\d+)?)px/); return m ? parseFloat(m[1]!) : 0; };
assert.ok(fonts.some((f) => { const p = pxOf(f); return p > 0 && p < 18; }), 'Font B renders smaller than 18px');
assert.ok(fonts.some((f) => pxOf(f) === 18), 'Font A renders at 18px (preview matches print)');

console.log('✓ chittie-preview spike — column-image + barcode + text rendered, no desync');
console.log(`  ${bytes.length} ESC/POS bytes → ${texts.length} glyphs, ${rects} image px, canvas ${canvas.width}x${canvas.height}`);

// --- label preview: TSPL bytes → canvas (renderLabel) ---
const labelBytes = label({ ...LABEL_PROFILES['40x30'], density: 8 }, { rasterizer })
  .box(0, 0, 320, 240, 2)
  .text(16, 16, 'ARTISAN HAUS', { font: '3' })
  .text(16, 72, 'Rs. 4,500', { font: '4', yMul: 2 })
  .barcode(16, 128, '4791234567890', { type: 'ean13', height: 50 })
  .qrcode(224, 16, 'https://shop.lk/p/SKU123', { cell: 4 })
  .text(16, 196, 'සිල්ක්') // non-Latin → BITMAP
  .encode();

const ltexts: string[] = [];
let lrects = 0;
const lctx: PreviewContext2D = {
  fillStyle: '', strokeStyle: '', font: '', textBaseline: '',
  fillRect: () => { lrects++; },
  strokeRect: () => {},
  fillText: (t) => { ltexts.push(t); },
  setLineDash: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {},
};
const lcanvas = renderLabel(labelBytes, { createCanvas: (w, h) => ({ width: w, height: h, getContext: () => lctx }) });
const lj = ltexts.join('');

assert.equal(lcanvas.width, 320, '40mm @203dpi → 320 dots');
assert.equal(lcanvas.height, 240, '30mm @203dpi → 240 dots');
assert.ok(lj.includes('ARTISAN HAUS'), 'TEXT rendered');
assert.ok(lj.includes('Rs. 4,500'), 'magnified TEXT rendered');
assert.ok(lj.includes('4791234567890'), 'barcode human-readable text');
assert.ok(lrects > 100, `box + bars + QR modules + BITMAP pixels drawn (got ${lrects})`);

console.log('✓ chittie-preview label spike — TSPL → canvas: TEXT ✓ BARCODE ✓ QR ✓ BOX ✓ BITMAP ✓');
console.log(`  ${labelBytes.length} TSPL bytes → ${ltexts.length} texts, ${lrects} rects, canvas ${lcanvas.width}x${lcanvas.height}`);
