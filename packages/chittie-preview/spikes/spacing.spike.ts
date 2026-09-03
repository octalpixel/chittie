/**
 * SPIKE: how much PAPER a receipt costs, measured through the preview parser.
 *
 * The preview models the line-feed pitch (ESC 2 / ESC 3 n), so it — not a
 * character count — answers "why is this receipt so long". Measured at a
 * pitch of 34 dots: a real 203-DPI printer's 1/6-inch default.
 *
 * Two shapes are measured, because they run long for different reasons:
 *   - a Latin receipt, where every line pays the printer's default pitch;
 *   - a Sinhala receipt, where every line is a column-mode image band and the
 *     pitch the encoder sets for those bands decides the whole length.
 */
import assert from 'node:assert/strict';
import { ReceiptPrinterEncoder } from '@angadie/chittie';
import { smartText, type TextRasterizer } from '@angadie/chittie-text';
import ImageData from '@canvas/image-data';
import { renderReceipt, type PreviewContext2D } from '../src/index.js';

const DPI = 203;
const PITCH = 34; // 1/6 inch at 203 DPI — the ESC/POS default a bare LF advances by
const COLUMNS = 48;
const GLYPH = 24; // font A height, and the height chittie-react rasterizes to at 203 DPI
const mm = (dots: number) => dots / (DPI / 25.4);

const rasterizer: TextRasterizer = {
  rasterize(_text, options) {
    const w = Math.min(options.maxWidth ?? 576, 576);
    const h = options.fontSize ?? GLYPH;
    const data = new Uint8ClampedArray(w * h * 4).fill(255);
    for (let p = 0; p < w * h; p += 3) { data[p * 4] = 0; data[p * 4 + 1] = 0; data[p * 4 + 2] = 0; }
    return new ImageData(data, w, h) as unknown as ImageData;
  },
};

const ctx: PreviewContext2D = {
  fillStyle: '', strokeStyle: '', font: '', textBaseline: '',
  fillRect: () => {}, strokeRect: () => {}, fillText: () => {},
  setLineDash: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {},
};

/** Paper length in dots, with the preview's cosmetic outer padding removed. */
const paperDots = (bytes: Uint8Array): number =>
  renderReceipt(bytes, {
    createCanvas: (w, h) => ({ width: w, height: h, getContext: () => ctx }),
    columns: COLUMNS,
    lineHeight: PITCH,
    padding: 0,
  }).height;

const ITEMS: Array<[string, string]> = [
  ['Linen wrap blouse', 'Rs. 7,800.00'],
  ['Batik scarf - orchid', 'Rs. 20,600.00'],
  ['Handloom sarong', 'Rs. 4,500.00'],
  ['Cotton kurta - indigo', 'Rs. 11,400.00'],
  ['Beeralu lace collar', 'Rs. 2,300.00'],
];

const encoder = (lineSpacing?: number) => {
  const e = new ReceiptPrinterEncoder({ columns: COLUMNS });
  e.initialize();
  if (lineSpacing !== undefined) e.lineSpacing(lineSpacing);
  return e;
};

/** A plain Latin receipt: N text lines, each advancing by the current pitch. */
function latin(lineSpacing?: number): Uint8Array {
  const e = encoder(lineSpacing);
  e.align('center').bold(true).line('ELU GALLE FACE BOUTIQUE').bold(false).align('left').rule();
  e.table([{ width: 34, align: 'left' }, { width: 14, align: 'right' }], ITEMS.map(([n, p]) => [n, p]));
  e.rule().align('center').line('Thank you!').align('left').newline(2).cut();
  return e.encode();
}

/** Every line rasterized — the shape of a Sinhala/Tamil receipt. */
function sinhala(lineSpacing?: number): Uint8Array {
  const e = encoder(lineSpacing);
  for (const [name] of ITEMS) {
    smartText(e, `ආයුබෝවන් ${name}`, { rasterizer, raster: { fontSize: GLYPH, maxWidth: 576, dpi: DPI } });
  }
  e.cut();
  return e.encode();
}

const supportsLineSpacing = typeof (new ReceiptPrinterEncoder({ columns: COLUMNS }) as unknown as {
  lineSpacing?: unknown;
}).lineSpacing === 'function';

const rows: Array<[string, number]> = [
  ['Latin receipt, printer default pitch', paperDots(latin())],
  ['Sinhala receipt, every line a raster band', paperDots(sinhala())],
];
if (supportsLineSpacing) {
  rows.push(['Latin receipt, lineSpacing(24)', paperDots(latin(GLYPH))]);
  rows.push(['Sinhala receipt, lineSpacing(24)', paperDots(sinhala(GLYPH))]);
}

console.log(`\npaper cost @ ${COLUMNS} cols, ${DPI} DPI, default pitch ${PITCH} dots\n`);
for (const [label, dots] of rows) {
  console.log(`  ${label.padEnd(44)} ${String(dots).padStart(5)} dots  ${mm(dots).toFixed(1).padStart(6)} mm`);
}
if (!supportsLineSpacing) console.log('\n  (encoder.lineSpacing() not available in this build)');

/* A rasterized line draws GLYPH dots. Anything beyond that per line is the
   band pitch feeding blank paper — the bug this spike exists to catch. */
const sinhalaDots = rows[1]![1];
const perLine = sinhalaDots / ITEMS.length;
console.log(`\n  Sinhala: ${sinhalaDots} dots for ${ITEMS.length} lines of ${GLYPH}-dot glyphs = ${perLine.toFixed(1)} dots/line`);

assert.ok(sinhalaDots > 0, 'receipt measured');
if (supportsLineSpacing) {
  assert.ok(rows[2]![1] < rows[0]![1], 'lineSpacing(24) shortens a Latin receipt');
}
console.log('\nok  spacing measured');
