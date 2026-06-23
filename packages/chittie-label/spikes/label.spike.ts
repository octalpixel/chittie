// SPIKE: chittie-label builds real TSPL byte streams — setup, positioned text/
// barcode/QR/box, BITMAP packing (correct polarity), non-Latin raster, no-silent-?.
import assert from 'node:assert/strict';
import ImageData from '@canvas/image-data';
import { label, LABEL_PROFILES, mmToDots, packBitmap, type TextRasterizer } from '../src/index.js';

// latin1 view for substring assertions (BITMAP binary becomes junk that won't match keywords)
const str = (u: Uint8Array) => Array.from(u, (c) => String.fromCharCode(c)).join('');

// 1. unit conversion (203 DPI = 8 dots/mm, 300 = 12)
assert.equal(mmToDots(1, 203), 8, '1mm = 8 dots @203');
assert.equal(mmToDots(1, 300), 12, '1mm = 12 dots @300');
assert.equal(mmToDots(25.4, 203), 203, '1 inch = 203 dots');

// 2. a real price tag → TSPL
const b = label({ ...LABEL_PROFILES['40x30'], density: 8, speed: 4 });
const bytes = b
  .text(b.mm(2), b.mm(2), 'Artisan Haus', { font: '3' })
  .text(b.mm(2), b.mm(9), 'Rs. 4,500', { font: '4', xMul: 2, yMul: 2 })
  .barcode(b.mm(2), b.mm(16), '4791234567890', { type: 'ean13', height: 50 })
  .qrcode(b.mm(28), b.mm(2), 'https://shop.lk/p/SKU123', { ecc: 'M', cell: 4 })
  .box(0, 0, b.mm(40), b.mm(30), 2)
  .encode({ copies: 2 });
const s = str(bytes);

assert.ok(s.includes('SIZE 40 mm,30 mm'), 'SIZE from profile');
assert.ok(s.includes('GAP 2 mm,0 mm'), 'GAP default');
assert.ok(s.includes('DIRECTION 1'), 'DIRECTION');
assert.ok(s.includes('DENSITY 8') && s.includes('SPEED 4'), 'density + speed');
assert.ok(s.includes('CLS'), 'CLS before drawing');
assert.ok(/TEXT 16,16,"3",0,1,1,"Artisan Haus"/.test(s), 'positioned TEXT');
assert.ok(/TEXT \d+,\d+,"4",0,2,2,"Rs\. 4,500"/.test(s), 'magnified TEXT');
assert.ok(/BARCODE 16,\d+,"EAN13",50,1,0,2,4,"4791234567890"/.test(s), 'EAN13 barcode (friendly name mapped)');
assert.ok(/QRCODE \d+,16,M,4,A,0,"https/.test(s), 'QRCODE');
assert.ok(/BOX 0,0,320,240,2/.test(s), 'BOX spans the label');
assert.ok(s.trimEnd().endsWith('PRINT 1,2'), 'PRINT sets,copies last');

// 3. BITMAP packing polarity: left 4px black, right 4px white → 0b00001111 = 0x0f
const probe = new ImageData(new Uint8ClampedArray(8 * 1 * 4), 8, 1) as unknown as ImageData;
for (let x = 0; x < 4; x++) {
  const i = x * 4;
  probe.data[i] = probe.data[i + 1] = probe.data[i + 2] = 0; // black
  probe.data[i + 3] = 255;
}
for (let x = 4; x < 8; x++) {
  const i = x * 4;
  probe.data[i] = probe.data[i + 1] = probe.data[i + 2] = 255; // white
  probe.data[i + 3] = 255;
}
const packed = packBitmap(probe);
assert.equal(packed.widthBytes, 1, 'ceil(8/8)=1 byte wide');
assert.equal(packed.bytes[0], 0x0f, 'dark→0 bit, light→1 bit, MSB-first (0b00001111)');

// 4. <image> emits a BITMAP command + the packed bytes
const withImg = label(LABEL_PROFILES['50x30']).image(10, 10, probe).encode();
assert.ok(str(withImg).includes('BITMAP 10,10,1,1,0,'), 'BITMAP header');

// 5. non-Latin: rasterized with a rasterizer, throws without (no silent ?)
const fake: TextRasterizer = { rasterize: () => new ImageData(new Uint8ClampedArray(24 * 16 * 4), 24, 16) as unknown as ImageData };
const sinhala = label(LABEL_PROFILES['40x30'], { rasterizer: fake }).text(10, 10, 'නම').encode();
assert.ok(str(sinhala).includes('BITMAP 10,10,'), 'non-Latin text → BITMAP via rasterizer');
assert.throws(() => label(LABEL_PROFILES['40x30']).text(10, 10, 'නම').encode(), /code page|rasterizer/, 'non-Latin without rasterizer throws');

// 6. quote/control safety — content can't break the command
const safe = str(label(LABEL_PROFILES['40x30']).text(0, 0, 'A "B"C').encode());
assert.ok(safe.includes(`"A 'B'C"`), 'quotes folded to \', control bytes stripped');

console.log('✓ chittie-label spike — TSPL setup ✓ TEXT ✓ BARCODE(EAN13) ✓ QRCODE ✓ BOX ✓ BITMAP polarity ✓ non-Latin raster ✓ quote-safe ✓');
