// chittie receipt -> PNG preview, via @angadie/chittie-preview + @napi-rs/canvas.
// Uses the DEFAULT image mode (column / ESC *) — chittie-preview parses it.
// Run: pnpm --filter @angadie/example-preview preview
import { ReceiptPrinterEncoder } from '@angadie/chittie';
import { smartText } from '@angadie/chittie-text';
import { renderReceipt } from '@angadie/chittie-preview';
import { createCanvas } from '@napi-rs/canvas';
import ImageData from '@canvas/image-data';
import { writeFileSync } from 'node:fs';

const COLUMNS = 32;
const DOTS = COLUMNS * 12;
const FONT = '"Sinhala Sangam MN", "Noto Sans Sinhala", sans-serif';

// a node rasterizer for complex scripts (the chittie-text injection point)
const rasterizer = {
  rasterize(text, { fontSize = 30 } = {}) {
    const m = createCanvas(8, 8).getContext('2d');
    m.font = `${fontSize}px ${FONT}`;
    const w = Math.min(Math.ceil(m.measureText(text).width) + 4, DOTS);
    const h = Math.ceil(fontSize * 1.5);
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    ctx.font = `${fontSize}px ${FONT}`;
    ctx.textBaseline = 'top';
    ctx.fillText(text, 2, 2);
    const id = ctx.getImageData(0, 0, w, h);
    return new ImageData(id.data, w, h);
  },
};

const enc = new ReceiptPrinterEncoder({ columns: COLUMNS }); // default column image mode
enc.initialize().align('center').bold(true).size(2, 2).line('Artisan Haus').size(1, 1).bold(false);
enc.align('center');
smartText(enc, 'ආයුබෝවන්!', { rasterizer }); // Sinhala -> raster image
enc.newline().align('center').line('Kotte, Colombo').align('left').rule();
enc.table(
  [{ width: 22, align: 'left' }, { width: 10, align: 'right' }],
  [
    ['2x Flat White', 'Rs. 1700'],
    ['1x Croissant', 'Rs. 650'],
  ]
);
enc.rule().bold(true).table([{ width: 22, align: 'left' }, { width: 10, align: 'right' }], [['TOTAL', 'Rs. 2350']]).bold(false);
enc.newline().align('center').line('Thank you!').newline(2).cut();
const bytes = enc.encode();

const canvas = renderReceipt(bytes, { createCanvas, columns: COLUMNS });
const out = new URL('./receipt.png', import.meta.url);
writeFileSync(out, canvas.toBuffer('image/png'));
console.log('wrote', out.pathname, `(${canvas.width}x${canvas.height}, ${bytes.length} ESC/POS bytes)`);
