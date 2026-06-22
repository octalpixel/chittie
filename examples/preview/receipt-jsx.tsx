// Demonstrates the JSX <Image> component end-to-end: JSX -> ESC/POS bytes ->
// chittie-preview PNG. Run: pnpm --filter @angadie/example-preview preview:jsx
import React from 'react';
import { Printer, Text, Image, Row, Line, Cut, render } from '@angadie/chittie';
import { renderReceipt } from '@angadie/chittie-preview';
import { createCanvas } from '@napi-rs/canvas';
import CanvasImageData from '@canvas/image-data';
import { writeFileSync } from 'node:fs';

const COLUMNS = 32;
const DOTS = COLUMNS * 12;
const FONT = '"Sinhala Sangam MN", "Noto Sans Sinhala", sans-serif';

const toImageData = (c: ReturnType<typeof createCanvas>) => {
  const id = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  return new CanvasImageData(id.data, c.width, c.height) as unknown as ImageData;
};

// logo: coffee cup + wordmark
function makeLogo(): ImageData {
  const W = DOTS;
  const H = 152;
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
  x.beginPath();
  x.moveTo(cx - cupW / 2, top);
  x.lineTo(cx + cupW / 2, top);
  x.lineTo(cx + cupW / 2 - 12, top + cupH);
  x.lineTo(cx - cupW / 2 + 12, top + cupH);
  x.closePath();
  x.fill();
  x.lineWidth = 9;
  x.beginPath();
  x.arc(cx + cupW / 2 + 4, top + cupH / 2 - 4, 16, -Math.PI / 2, Math.PI / 2);
  x.stroke();
  x.fillRect(cx - cupW / 2 - 12, top + cupH + 7, cupW + 24, 8);
  x.lineWidth = 5;
  for (const dx of [-18, 0, 18]) {
    x.beginPath();
    x.moveTo(cx + dx, top - 16);
    x.quadraticCurveTo(cx + dx + 9, top - 7, cx + dx, top - 1);
    x.stroke();
  }
  x.font = 'bold 32px sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'top';
  x.fillText('ARTISAN HAUS', cx, top + cupH + 26);
  return toImageData(c);
}

const rasterizer = {
  rasterize(text: string, { fontSize = 30 }: { fontSize?: number } = {}) {
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
    return toImageData(c);
  },
};

// the receipt — authored entirely in JSX, including the logo <Image>
const receipt = (
  <Printer width={COLUMNS}>
    <Image image={makeLogo()} align="center" dither="threshold" />
    <Text align="center">ආයුබෝවන්!</Text>
    <Text align="center">Kotte, Colombo</Text>
    <Line />
    <Row left="2x Flat White" right="Rs. 1700" />
    <Row left="1x Croissant" right="Rs. 650" />
    <Line />
    <Row left="TOTAL" right="Rs. 2350" />
    <Text align="center">Thank you!</Text>
    <Cut />
  </Printer>
);

const bytes = render(receipt, { rasterizer, columns: COLUMNS });
const canvas = renderReceipt(bytes, { createCanvas, columns: COLUMNS });
const out = new URL('./receipt-jsx.png', import.meta.url);
writeFileSync(out, canvas.toBuffer('image/png'));
console.log('wrote', out.pathname, `(${canvas.width}x${canvas.height}, ${bytes.length} ESC/POS bytes)`);
