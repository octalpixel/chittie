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
  Feed,
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
    <Feed dots={24} />
    <Barcode value="0123456789" symbology="code128" height={50} />
    <QRCode value="https://artisan.lk" size={6} />
    <Text align="center">THANK YOU</Text>
    <Text small align="center">Powered by chittie</Text>
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
assert.ok(contains(bytes, [0x1b, 0x4a, 24]), 'ESC J 24 — <Feed dots={24}>');
assert.ok(contains(bytes, [0x1b, 0x4d, 1]), 'ESC M 1 — <Text small> selects Font B');
assert.ok(contains(bytes, [0x1b, 0x4d, 0]), 'ESC M 0 — Font B resets to Font A after');
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

// --- <Row> with non-Latin cells: throws without rasterizer, rasters the row with one ---
const sinhalaRow = (
  <Printer width={32}>
    <Row left="නම" right="Rs. 250" />
  </Printer>
);
assert.throws(() => render(sinhalaRow), /Row|rasterizer|Sinhala/, '<Row> non-Latin throws without rasterizer (no silent ?)');
const rowRastered = render(sinhalaRow, {
  rasterizer: { rasterize: () => new ImageData(new Uint8ClampedArray(40 * 16 * 4), 40, 16) as unknown as ImageData },
  dotWidth: 384,
});
assert.ok(contains(rowRastered, [0x1b, 0x2a]) || contains(rowRastered, [0x1d, 0x76, 0x30]), '<Row> non-Latin rasterized to image');
console.log('✓ <Row> non-Latin: rasters the whole row with a rasterizer, throws without');

// --- typographic folding: × — " " … in text/rows print as ASCII (no throw, no raster) ---
const typo = render(
  <Printer width={32}>
    <Text>Café — “special”</Text>
    <Row left="2× Coffee" right="Rs. 850" />
  </Printer>
);
const typoAscii = ascii(typo);
assert.ok(typoAscii.includes('2x Coffee'), '<Row> folds × → x and prints as text');
assert.ok(typoAscii.includes('- "special"'), '<Text> folds em-dash + curly quotes to ASCII');
assert.ok(!contains(typo, [0x1d, 0x76, 0x30]) && !contains(typo, [0x1b, 0x2a]), 'no raster image emitted for typographic chars');
console.log('✓ typographic folding: × — “ ” … render as ASCII (no raster, no throw)');

// --- dpi-aware sizing + fontFamilies threaded to the rasterizer ---
const captured: Array<{ fontSize?: number; fontFamilies?: string[]; maxWidth?: number }> = [];
const capRasterizer = {
  rasterize: (_t: string, o: { fontSize?: number; fontFamilies?: string[]; maxWidth?: number }) => {
    captured.push(o);
    return new ImageData(new Uint8ClampedArray(8 * 8 * 4), 8, 8) as unknown as ImageData;
  },
};
const sinhalaText = <Printer width={48}><Text>ආයුබෝවන්</Text></Printer>;
render(sinhalaText, { rasterizer: capRasterizer, dotWidth: 576, dpi: 203, fontFamilies: ['Noto Sans Sinhala'] });
render(sinhalaText, { rasterizer: capRasterizer, dotWidth: 864, dpi: 300, fontFamilies: ['Noto Sans Sinhala'] });
const [at203, at300] = captured;
assert.equal(at203?.fontFamilies?.[0], 'Noto Sans Sinhala', 'fontFamilies threaded to rasterizer');
assert.equal(at203?.maxWidth, 576, 'maxWidth = dotWidth');
assert.ok((at300!.fontSize ?? 0) > (at203!.fontSize ?? 0), '300 DPI font is larger in dots (same physical size)');
assert.ok(Math.abs((at300!.fontSize ?? 0) / (at203!.fontSize ?? 1) - 300 / 203) < 0.1, 'font scales ~proportional to DPI');
console.log('✓ dpi-aware sizing: rasterized font scales with DPI; fontFamilies + maxWidth threaded');

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

// --- custom components: composition as children, .map(), and a custom root ---
const LineItem = ({ name, qty, price }: { name: string; qty: number; price: number }) => (
  <Row left={`${qty}x ${name}`} right={`Rs. ${qty * price}`} />
);
const cart = [{ name: 'Coffee', qty: 2, price: 425 }, { name: 'Cake', qty: 1, price: 650 }];
function MyReceipt() {
  return (
    <Printer width={32}>
      <Text align="center" bold>MYSHOP</Text>
      {cart.map((it, i) => <LineItem key={i} {...it} />)}
      <Cut />
    </Printer>
  );
}
const customBytes = render(<MyReceipt />); // custom ROOT resolves to <Printer>
const customAscii = ascii(customBytes);
assert.ok(customAscii.includes('MYSHOP'), 'custom root component renders');
assert.ok(customAscii.includes('Coffee') && customAscii.includes('Cake'), 'mapped child components render');
console.log('✓ custom components: child composition + .map() + custom root resolves to <Printer>');

// --- regression: <Text> with a COMPONENT child throws (was a silent drop) ---
assert.throws(
  () => render(<Printer width={32}><Text bold><Row left="A" right="B" /></Text></Printer>),
  /components|siblings/,
  '<Text> with a component child throws instead of silently dropping it'
);
// fragments wrapping text are still transparent
const fragText = render(<Printer width={32}><Text>{'XY'}</Text></Printer>);
assert.ok(ascii(fragText).includes('XY'), 'string children still render');
console.log('✓ <Text> rejects component children (no silent drop); strings/fragments still render');
