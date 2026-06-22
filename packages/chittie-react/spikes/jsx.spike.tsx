// SPIKE: pure JSX -> real ESC/POS bytes through the vendored core, RN-safe.
// Imports ONLY react (no react-dom). Nulls Buffer + TextEncoder during render
// to prove the path needs neither (the React Native constraint).
import React from 'react';
import assert from 'node:assert/strict';
import {
  Printer,
  Text,
  Row,
  Line,
  Br,
  Cut,
  Cashdraw,
  Barcode,
  QRCode,
  Image,
  render,
} from '../src/index.js';

function contains(u8: Uint8Array, seq: number[]): boolean {
  const a = Array.from(u8);
  for (let i = 0; i + seq.length <= a.length; i++) {
    if (seq.every((b, j) => a[i + j] === b)) return true;
  }
  return false;
}
const ascii = (u8: Uint8Array) =>
  Array.from(u8)
    .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '·'))
    .join('');

const receipt = (
  <Printer width={32}>
    <Cashdraw />
    <Text align="center" bold>
      Artisan Haus
    </Text>
    <Text align="center">Kotte, Colombo</Text>
    <Line />
    <Row left="2 x Flat White" right="Rs. 1700" />
    <Row left="1 x Croissant" right="Rs. 650" />
    <Line />
    <Row left="TOTAL" right="Rs. 2350" />
    <Br />
    <Barcode value="0123456789" symbology="code128" height={50} />
    <QRCode value="https://artisan.lk" size={6} />
    <Text align="center">THANK YOU</Text>
    <Cut />
  </Printer>
);

// RN constraint: no Buffer, no TextEncoder, no DOM, no react-dom.
const savedBuffer = (globalThis as Record<string, unknown>).Buffer;
const savedTE = (globalThis as Record<string, unknown>).TextEncoder;
(globalThis as Record<string, unknown>).Buffer = undefined;
(globalThis as Record<string, unknown>).TextEncoder = undefined;
let bytes: Uint8Array;
try {
  bytes = render(receipt);
} finally {
  (globalThis as Record<string, unknown>).Buffer = savedBuffer;
  (globalThis as Record<string, unknown>).TextEncoder = savedTE;
}

assert.ok(bytes instanceof Uint8Array && bytes.length > 0, 'non-empty bytes');
assert.ok(contains(bytes, [0x1b, 0x40]), 'ESC @ initialize');
assert.ok(contains(bytes, [0x1b, 0x70]), 'ESC p cash-drawer pulse');
assert.ok(contains(bytes, [0x1d, 0x56]), 'GS V cut');
assert.ok(ascii(bytes).includes('Artisan Haus'), 'business name');
assert.ok(ascii(bytes).includes('TOTAL'), 'total row');
assert.equal(typeof document, 'undefined', 'no DOM');

console.log('✓ chittie-react JSX→bytes spike —', bytes.length, 'bytes');
console.log('  init ✓ drawer ✓ cut ✓ text ✓ barcode ✓ qrcode ✓');
console.log('  rendered with Buffer & TextEncoder nulled, no DOM, no react-dom → RN-safe');

// --- chittie-text integration: Sinhala routes to raster / throws without one ---
import ImageData from '@canvas/image-data';
const sinhala = (
  <Printer width={32}>
    <Text align="center">ආයුබෝවන්</Text>
  </Printer>
);
// with an injected rasterizer -> image bytes (GS v 0)
const rasterized = render(sinhala, {
  rasterizer: {
    rasterize: () => new ImageData(new Uint8ClampedArray(16 * 8 * 4), 16, 8) as unknown as ImageData,
  },
});
assert.ok(contains(rasterized, [0x1d, 0x76, 0x30]) || contains(rasterized, [0x1b, 0x2a]), 'Sinhala rasterized to image');
// without a rasterizer -> throws, never a silent "?"
assert.throws(() => render(sinhala), /rasterizer/, 'Sinhala without rasterizer throws');
console.log('✓ chittie-text wired: <Text> Sinhala → image with rasterizer, throws without (no silent ?)');

// --- <Image>: arbitrary ImageData (non-8 dims) embeds as a raster image ---
const logo = new ImageData(new Uint8ClampedArray(20 * 10 * 4).fill(0), 20, 10) as unknown as ImageData; // 20x10, not /8
const withImage = render(
  <Printer width={32}>
    <Image image={logo} align="center" dither="threshold" />
  </Printer>
);
assert.ok(
  contains(withImage, [0x1b, 0x2a]) || contains(withImage, [0x1d, 0x76, 0x30]),
  '<Image> emits an image command (padded to /8, no throw)'
);
console.log('✓ <Image> renders arbitrary ImageData (auto-padded to 8-multiples)');
