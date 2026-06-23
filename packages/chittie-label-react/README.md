# @angadie/chittie-label-react

**Pure JSX authoring for TSPL labels** → bytes. A `<Label>` with coordinate-positioned
`<LText>` / `<LBarcode>` / `<LQR>` / `<LBox>` / `<LBar>` / `<LImage>`. Mirrors
`@angadie/chittie-react` (receipts) — RN-safe, no `react-dom`, no HTML host elements.
Renders onto `@angadie/chittie-label`.

```bash
npm i @angadie/chittie-label-react @angadie/chittie-label react
```

## A price tag in JSX

```tsx
import { Label, LText, LBarcode, LQR, LBox, render, LABEL_PROFILES } from '@angadie/chittie-label-react';

const tag = (
  <Label profile={{ ...LABEL_PROFILES['40x30'], density: 8 }} print={{ copies: 2 }}>
    <LBox x={0} y={0} w={320} h={240} thickness={2} />
    <LText x={16} y={16} font="3">ARTISAN HAUS</LText>
    <LText x={16} y={72} font="4" xMul={2} yMul={2}>Rs. 4,500</LText>
    <LBarcode x={16} y={128} data="4791234567890" type="ean13" height={50} />
    <LQR x={224} y={16} data="https://shop.lk/p/SKU123" cell={4} />
  </Label>
);

const bytes = render(tag); // Uint8Array → any chittie transport (Web Serial / BLE / Tauri / TCP)
```

Author a template once, map your products into the slots:

```tsx
const PriceTag = ({ p }: { p: Product }) => (
  <Label profile={LABEL_PROFILES['40x30']}>
    <LText x={16} y={16} font="3">{p.name}</LText>
    <LText x={16} y={64} font="4" xMul={2} yMul={2}>{p.priceLabel}</LText>
    <LBarcode x={16} y={120} data={p.gtin} type="ean13" />
  </Label>
);
```

## Components

| element | props | → |
|---|---|---|
| `<Label profile rasterizer? print?>` | root: `profile` (mm/dpi/gap/density…), optional `rasterizer`, `print={{sets,copies}}` | TSPL job |
| `<LText x y font? rotation? xMul? yMul?>` | text (children) | `TEXT` (non-Latin → raster) |
| `<LBarcode x y data type? height? human? narrow? wide?>` | 1D barcode | `BARCODE` |
| `<LQR x y data ecc? cell?>` | QR | `QRCODE` |
| `<LBox x y w h thickness?>` | outline | `BOX` |
| `<LBar x y w h>` | filled bar | `BAR` |
| `<LImage x y image mode? threshold?>` | `ImageData` | `BITMAP` |

Coordinates are in **dots** (`mmToDots(mm, dpi)` to convert). Non-Latin `<LText>`
rasterizes via the `<Label rasterizer={…}>` (or throws — never a silent `?`).
See `@angadie/chittie-label` for the underlying builder, barcode types, and profiles.
