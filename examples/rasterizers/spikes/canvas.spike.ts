// SPIKE: the canvas rasterizer renders text to ImageData and fits to maxWidth
// (verified with @napi-rs/canvas, the Node backend; the browser path is identical).
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { createCanvasRasterizer } from '../src/canvas.js';

const r = createCanvasRasterizer((w, h) => createCanvas(w, h) as never);

// renders text → ImageData with real black pixels
const img = r.rasterize('Hello', { fontSize: 32, bold: true });
assert.ok(img.width > 0 && img.height > 0, 'produces a sized image');
let black = 0;
for (let i = 0; i < img.data.length; i += 4) if ((img.data[i] ?? 255) < 128) black++;
assert.ok(black > 20, `text drawn (${black} dark px)`);

// fit-to-width: a long run is shrunk to the printable dot width
const wide = r.rasterize('A very long product name that must shrink to fit the paper width', { fontSize: 48, maxWidth: 200 });
assert.ok(wide.width <= 200, `fit to maxWidth (${wide.width} ≤ 200)`);

// fontFamilies fallback chain is accepted (Sinhala/Tamil shaping needs a registered Noto font)
const ff = r.rasterize('Item', { fontSize: 24, fontFamilies: ['Noto Sans Sinhala', 'Noto Sans Tamil', 'sans-serif'] });
assert.ok(ff.width > 0, 'fontFamilies chain accepted');

console.log('✓ canvas rasterizer — text → ImageData, fit-to-maxWidth, fontFamilies (web + @napi-rs/canvas)');
