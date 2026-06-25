// SPIKE: the TS adapter (off-device). A fake native HybridObject returns a /8 RGBA
// bitmap; makeRasterizer must wrap it as a structural ImageData that flows through
// chittie's raster packer (padTo8) unchanged. Verifies the integration without Nitro.
import assert from 'node:assert/strict';
import { padTo8 } from '@angadie/chittie-text';
import { makeRasterizer } from '../src/adapter.js';
import type { ChittieRasterizer } from '../src/specs/ChittieRasterizer.nitro.js';

let lastArgs: { text: string; fontSize: number; maxWidth: number; bold: boolean } | undefined;
const fakeNative = {
  rasterize(text: string, fontSize: number, maxWidth: number, bold: boolean) {
    lastArgs = { text, fontSize, maxWidth, bold };
    const w = 16;
    const h = 8; // already multiples of 8 (the native contract)
    return { data: new Uint8Array(w * h * 4).fill(255).buffer, width: w, height: h };
  },
} as unknown as ChittieRasterizer;

const r = makeRasterizer(fakeNative);
const img = r.rasterize('ආයුබෝවන්', { fontSize: 24, maxWidth: 384, bold: true });

assert.equal(img.width, 16, 'width from native');
assert.equal(img.height, 8, 'height from native');
assert.equal(img.data.length, 16 * 8 * 4, 'RGBA buffer wrapped as Uint8ClampedArray');
assert.equal(lastArgs?.text, 'ආයුබෝවන්', 'text passed to native');
assert.equal(lastArgs?.fontSize, 24, 'fontSize passed');
assert.equal(lastArgs?.maxWidth, 384, 'maxWidth passed');
assert.equal(lastArgs?.bold, true, 'bold passed');

// integrates with chittie's ESC/POS raster packer — /8 dims pass through unchanged
const padded = padTo8(img);
assert.equal(padded.width, 16);
assert.equal(padded.height, 8);
assert.equal(padded, img, 'padTo8 returns a /8 image unchanged (no ImageData ctor needed)');

console.log('✓ chittie-react-native adapter spike — native bitmap → ImageData → padTo8 OK');
