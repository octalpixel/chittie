// chittie receipt -> PNG preview. Parses the REAL ESC/POS bytes chittie emits
// (a mini-emulator) so you see what the printer would actually print — including
// the rasterized Sinhala line. Run: pnpm --filter @angadie/example-preview preview
import { ReceiptPrinterEncoder } from '@angadie/chittie';
import { smartText } from '@angadie/chittie-text';
import { createCanvas } from '@napi-rs/canvas';
import ImageData from '@canvas/image-data';
import { writeFileSync } from 'node:fs';

const COLUMNS = 32;
const CELL_W = 12; // px per character cell
const LINE_H = 26;
const DOTS = COLUMNS * CELL_W; // paper dot width for this preview
const PAD = 16;

// --- a node rasterizer (same role as the web canvas one) for complex scripts ---
const FONT = '"Sinhala Sangam MN", "Noto Sans Sinhala", sans-serif';
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

// --- build a receipt (builder API + smartText for the non-Latin line) ---
const enc = new ReceiptPrinterEncoder({ columns: COLUMNS, imageMode: 'raster' });
enc.initialize().align('center').bold(true).size(2, 2).line('Artisan Haus').size(1, 1).bold(false);
enc.align('center');
smartText(enc, 'ආයුබෝවන්!', { rasterizer }); // Sinhala -> raster image
enc.newline();
enc.align('center').line('Kotte, Colombo').align('left').rule();
enc.table(
  [{ width: 22, align: 'left' }, { width: 10, align: 'right' }],
  [
    ['2x Flat White', 'Rs. 1700'],
    ['1x Croissant', 'Rs. 650'],
  ]
);
enc.rule();
enc.bold(true).table([{ width: 22, align: 'left' }, { width: 10, align: 'right' }], [['TOTAL', 'Rs. 2350']]).bold(false);
enc.newline().align('center').line('Thank you!').newline(2).cut();
const bytes = enc.encode();

// --- cp437 high-byte glyphs we actually use ---
const CP437 = { 0xc4: '─', 0xb3: '│', 0xcd: '═', 0xc5: '┼', 0xda: '┌', 0xbf: '┐', 0xc0: '└', 0xd9: '┘' };
const decode = (b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : CP437[b] ?? '');

// --- parse the ESC/POS stream into draw ops ---
const ops = [];
let x = 0;
let y = PAD;
let bold = false;
let wScale = 1;
let hScale = 1;
let lineH = LINE_H;
let i = 0;
const u16 = (lo, hi) => lo + hi * 256;

while (i < bytes.length) {
  const b = bytes[i];
  if (b === 0x1b) {
    const c = bytes[i + 1];
    if (c === 0x40) i += 2; // ESC @ init
    else if (c === 0x45) { bold = !!bytes[i + 2]; i += 3; } // ESC E n bold
    else if (c === 0x74 || c === 0x4d || c === 0x52) i += 3; // ESC t/M/R n (codepage/font) — ignore
    else i += 2; // other ESC x — skip cmd
  } else if (b === 0x1d) {
    const c = bytes[i + 1];
    if (c === 0x21) { // GS ! n  char size
      const n = bytes[i + 2];
      wScale = ((n >> 4) & 0x07) + 1;
      hScale = (n & 0x07) + 1;
      lineH = LINE_H * hScale;
      i += 3;
    } else if (c === 0x56) { // GS V n  cut
      ops.push({ t: 'cut', y });
      y += 14;
      i += 3;
    } else if (c === 0x76 && bytes[i + 2] === 0x30) { // GS v 0  raster image
      const wbytes = u16(bytes[i + 4], bytes[i + 5]);
      const h = u16(bytes[i + 6], bytes[i + 7]);
      const start = i + 8;
      const w = wbytes * 8;
      ops.push({ t: 'img', x: 0, y, w, h, wbytes, data: bytes.subarray(start, start + wbytes * h) });
      y += h + 6;
      x = 0;
      i = start + wbytes * h;
    } else i += 2;
  } else if (b === 0x1c) {
    i += 2; // FS . etc.
  } else if (b === 0x0a) { // LF
    y += lineH;
    x = 0;
    lineH = LINE_H * hScale;
    i += 1;
  } else if (b === 0x0d) {
    i += 1; // CR — ignore
  } else {
    const ch = decode(b);
    if (ch) ops.push({ t: 'ch', x, y, ch, bold, w: wScale, h: hScale });
    x += CELL_W * wScale;
    i += 1;
  }
}

// --- render ops to a canvas ---
const height = y + PAD;
const canvas = createCanvas(DOTS + PAD * 2, height);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#fff';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#000';
ctx.textBaseline = 'top';

for (const op of ops) {
  if (op.t === 'ch') {
    const fs = 18 * op.h;
    ctx.font = `${op.bold ? 'bold ' : ''}${fs}px monospace`;
    ctx.fillText(op.ch, PAD + op.x, op.y);
  } else if (op.t === 'cut') {
    ctx.save();
    ctx.strokeStyle = '#999';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(PAD, op.y);
    ctx.lineTo(PAD + DOTS, op.y);
    ctx.stroke();
    ctx.restore();
  } else if (op.t === 'img') {
    // expand 1-bit raster (MSB-first, 1 = black) to black rects
    for (let row = 0; row < op.h; row++) {
      for (let col = 0; col < op.w; col++) {
        const byte = op.data[row * op.wbytes + (col >> 3)];
        if (byte & (0x80 >> (col & 7))) ctx.fillRect(PAD + op.x + col, op.y + row, 1, 1);
      }
    }
  }
}

const out = new URL('./receipt.png', import.meta.url);
writeFileSync(out, canvas.toBuffer('image/png'));
console.log('wrote', out.pathname, `(${canvas.width}x${canvas.height}, ${bytes.length} ESC/POS bytes)`);
