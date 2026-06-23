// SPIKE: pure JSX → TSPL bytes through chittie-label. Imports only react (no react-dom).
import React from 'react';
import assert from 'node:assert/strict';
import ImageData from '@canvas/image-data';
import { Label, LText, LBarcode, LQR, LBox, LBar, LImage, render, LABEL_PROFILES, type TextRasterizer } from '../src/index.js';

const str = (u: Uint8Array) => Array.from(u, (c) => String.fromCharCode(c)).join('');

// A price tag authored as JSX
const tag = (
  <Label profile={{ ...LABEL_PROFILES['40x30'], density: 8 }} print={{ copies: 2 }}>
    <LBox x={0} y={0} w={320} h={240} thickness={2} />
    <LText x={16} y={16} font="3">
      ARTISAN HAUS
    </LText>
    <LText x={16} y={72} font="4" xMul={2} yMul={2}>
      Rs. 4,500
    </LText>
    <LBarcode x={16} y={128} data="4791234567890" type="ean13" height={50} />
    <LQR x={224} y={16} data="https://shop.lk/p/SKU123" cell={4} />
    <LBar x={16} y={120} w={288} h={2} />
  </Label>
);

const s = str(render(tag));
assert.ok(s.includes('SIZE 40 mm,30 mm') && s.includes('CLS'), 'profile → SIZE + CLS');
assert.ok(s.includes('DENSITY 8'), 'profile density');
assert.ok(/BOX 0,0,320,240,2/.test(s), '<LBox>');
assert.ok(/TEXT 16,16,"3",0,1,1,"ARTISAN HAUS"/.test(s), '<LText>');
assert.ok(/TEXT 16,72,"4",0,2,2,"Rs\. 4,500"/.test(s), '<LText> magnified');
assert.ok(/BARCODE 16,128,"EAN13",50,1,0,2,4,"4791234567890"/.test(s), '<LBarcode> EAN13');
assert.ok(/QRCODE 224,16,M,4,A,0,"https/.test(s), '<LQR>');
assert.ok(/BAR 16,120,288,2/.test(s), '<LBar>');
assert.ok(s.trimEnd().endsWith('PRINT 1,2'), 'print={{copies:2}} → PRINT 1,2');
console.log('✓ JSX → TSPL: <Label>/<LBox>/<LText>/<LBarcode>/<LQR>/<LBar> render to bytes');

// custom root component resolves to <Label>
const PriceTag = ({ name }: { name: string }) => (
  <Label profile={LABEL_PROFILES['50x30']}>
    <LText x={10} y={10}>{name}</LText>
  </Label>
);
assert.ok(str(render(<PriceTag name="Silk Scarf" />)).includes('"Silk Scarf"'), 'custom root resolves');

// non-Latin: rasterized with a rasterizer, throws without (no silent ?)
const fake: TextRasterizer = { rasterize: () => new ImageData(new Uint8ClampedArray(24 * 16 * 4), 24, 16) as unknown as ImageData };
const sin = (
  <Label profile={LABEL_PROFILES['40x30']} rasterizer={fake}>
    <LText x={10} y={10}>සිල්ක්</LText>
  </Label>
);
assert.ok(str(render(sin)).includes('BITMAP 10,10,'), 'non-Latin <LText> → BITMAP via rasterizer');
assert.throws(
  () => render(<Label profile={LABEL_PROFILES['40x30']}><LText x={10} y={10}>සිල්ක්</LText></Label>),
  /code page|rasterizer/,
  'non-Latin without rasterizer throws'
);

// <LImage> embeds a BITMAP
const logo = new ImageData(new Uint8ClampedArray(16 * 8 * 4), 16, 8) as unknown as ImageData;
assert.ok(
  str(render(<Label profile={LABEL_PROFILES['40x30']}><LImage x={5} y={5} image={logo} /></Label>)).includes('BITMAP 5,5,'),
  '<LImage> → BITMAP'
);

// <LText> with a component child throws (no silent drop)
assert.throws(
  () => render(<Label profile={LABEL_PROFILES['40x30']}><LText x={0} y={0}><LBar x={0} y={0} w={1} h={1} /></LText></Label>),
  /components/,
  '<LText> rejects component children'
);

console.log('✓ chittie-label-react spike — JSX labels ✓ custom root ✓ non-Latin raster ✓ <LImage> ✓ no silent drop');
