// GROUND TRUTH for the receipt spacing/gaps the user sees on a 58mm print.
// Renders the same tree with the CURRENT built packages, dumps the byte-level
// feed structure, and writes a preview PNG to measure the gaps in pixels.
import { createElement as h } from 'react';
import { createCanvas } from '@napi-rs/canvas';
import { Printer, Text, Row, Line, render, type TextRasterizer } from '@angadie/chittie';
import { renderReceipt } from '@angadie/chittie-preview';
import { writeFileSync } from 'node:fs';

const rasterizer: TextRasterizer = {
  rasterize(text, { fontSize = 28, maxWidth = 576 } = {}) {
    const probe = createCanvas(10, 10).getContext('2d');
    const font = `${fontSize}px sans-serif`;
    probe.font = font;
    const m = probe.measureText(text);
    const ascent = Math.ceil(m.actualBoundingBoxAscent || fontSize * 0.8);
    const descent = Math.ceil(m.actualBoundingBoxDescent || fontSize * 0.22);
    const w = Math.min(Math.ceil(m.width) + 4, maxWidth);
    const hh = ascent + descent + 2;
    const c = createCanvas(w, hh);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, hh);
    ctx.fillStyle = '#000';
    ctx.font = font;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, 2, ascent + 1);
    return ctx.getImageData(0, 0, w, hh) as unknown as ImageData;
  },
};

const tree = h(
  Printer,
  { width: 32 },
  h(Text, { align: 'center', bold: true, size: { width: 2, height: 2 } }, 'Artisan Haus'),
  h(Text, { align: 'center' }, 'ආයුබෝවන්'),
  h(Line),
  h(Row, { left: '2x Flat White', right: 'Rs. 1,700' }),
  h(Row, { left: '1x Croissant', right: 'Rs. 650' }),
  h(Line),
  h(Row, { left: 'TOTAL', right: 'Rs. 2,350' })
);

const bytes = render(tree, { dotWidth: 384, rasterizer });

// --- byte-level feed analysis ---
const b = Array.from(bytes);
let lf = 0;
const events: string[] = [];
for (let i = 0; i < b.length; i++) {
  if (b[i] === 0x0a) { lf++; events.push(`@${i} LF`); }
  else if (b[i] === 0x1d && b[i + 1] === 0x76 && b[i + 2] === 0x30) {
    // GS v 0 m xL xH yL yH  → height = yL + yH*256 (rows)
    const yL = b[i + 6], yH = b[i + 7];
    events.push(`@${i} RASTER h=${yL + yH * 256} rows`);
  } else if (b[i] === 0x1b && b[i + 1] === 0x33) { events.push(`@${i} ESC 3 (line-spacing=${b[i + 2]})`); }
  else if (b[i] === 0x1b && b[i + 1] === 0x32) { events.push(`@${i} ESC 2 (default line-spacing)`); }
  else if (b[i] === 0x1d && b[i + 1] === 0x21) { events.push(`@${i} GS ! size=0x${(b[i + 2]).toString(16)}`); }
}
console.log('total bytes:', bytes.length, '| line feeds:', lf);
console.log(events.join('\n'));

// --- render to PNG + measure whitespace rows ---
const canvas = renderReceipt(bytes, { createCanvas: (w: number, hgt: number) => createCanvas(w, hgt) as never, columns: 32 }) as unknown as { width: number; height: number; getContext: (t: string) => CanvasRenderingContext2D; toBuffer: (m: string) => Buffer };
writeFileSync('/tmp/gap-receipt.png', canvas.toBuffer('image/png'));
const ctx = canvas.getContext('2d');
const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
let run = 0, maxRun = 0, gaps = 0;
for (let y = 0; y < canvas.height; y++) {
  let ink = false;
  for (let x = 0; x < canvas.width; x++) { if (img.data[(y * canvas.width + x) * 4] < 128) { ink = true; break; } }
  if (!ink) run++;
  else { if (run > 12) { gaps++; } maxRun = Math.max(maxRun, run); run = 0; }
}
console.log(`PNG ${canvas.width}x${canvas.height} | blank-row gaps >12px: ${gaps} | largest blank run: ${maxRun}px`);
console.log('wrote /tmp/gap-receipt.png');
