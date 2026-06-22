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

// draw a black-on-white logo (coffee cup + wordmark). Dims are multiples of 8
// (ESC/POS raster requirement). Returns ImageData for encoder.image().
function makeLogo() {
  const W = DOTS; // 384, /8 = 48
  const H = 152; // /8 = 19
  const c = createCanvas(W, H);
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.fillRect(0, 0, W, H);
  x.fillStyle = '#000';
  x.strokeStyle = '#000';
  const cx = W / 2;
  const top = 20;
  const cupW = 92;
  const cupH = 52;
  // cup body (trapezoid)
  x.beginPath();
  x.moveTo(cx - cupW / 2, top);
  x.lineTo(cx + cupW / 2, top);
  x.lineTo(cx + cupW / 2 - 12, top + cupH);
  x.lineTo(cx - cupW / 2 + 12, top + cupH);
  x.closePath();
  x.fill();
  // handle
  x.lineWidth = 9;
  x.beginPath();
  x.arc(cx + cupW / 2 + 4, top + cupH / 2 - 4, 16, -Math.PI / 2, Math.PI / 2);
  x.stroke();
  // saucer
  x.fillRect(cx - cupW / 2 - 12, top + cupH + 7, cupW + 24, 8);
  // steam
  x.lineWidth = 5;
  for (const dx of [-18, 0, 18]) {
    x.beginPath();
    x.moveTo(cx + dx, top - 16);
    x.quadraticCurveTo(cx + dx + 9, top - 7, cx + dx, top - 1);
    x.stroke();
  }
  // wordmark
  x.font = 'bold 32px sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'top';
  x.fillText('ARTISAN HAUS', cx, top + cupH + 26);
  const id = x.getImageData(0, 0, W, H);
  return { img: new ImageData(id.data, W, H), w: W, h: H };
}

const logo = makeLogo();
const enc = new ReceiptPrinterEncoder({ columns: COLUMNS }); // default column image mode
enc.initialize().align('center').image(logo.img, logo.w, logo.h, 'threshold', 128).newline();
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
