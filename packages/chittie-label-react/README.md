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
| `<Label>` | **`profile`** (required — mm/dpi/gap/density…), `rasterizer?`, `print?={{ sets?, copies? }}` | TSPL job |
| `<LText>` | **`x`**, **`y`**, `font?`, `rotation?`, `xMul?`, `yMul?`, `rasterFontSize?` + text children | `TEXT` (non-Latin → raster) |
| `<LBarcode>` | **`x`**, **`y`**, **`data`** (string \| number), `type?`, `height?`, `human?` (`0`\|`1`\|`2`), `rotation?`, `narrow?`, `wide?` | `BARCODE` |
| `<LQR>` | **`x`**, **`y`**, **`data`**, `ecc?` (`L`\|`M`\|`Q`\|`H`), `cell?`, `rotation?` | `QRCODE` |
| `<LBox>` | **`x`**, **`y`**, **`w`**, **`h`**, `thickness?` | `BOX` |
| `<LBar>` | **`x`**, **`y`**, **`w`**, **`h`** | `BAR` |
| `<LImage>` | **`x`**, **`y`**, **`image`** (`ImageData`), `mode?` (`0`\|`1`\|`2`), `threshold?` | `BITMAP` |

Bold props are required. `rotation` is `0 | 90 | 180 | 270` on every element that takes it.
`<Label>` throws without a `profile`; `render(element)` takes no options — everything is
declared on `<Label>`.

Coordinates are in **dots** (`mmToDots(mm, dpi)` to convert). Non-Latin `<LText>`
rasterizes via the `<Label rasterizer={…}>` (or throws — never a silent `?`), at
`rasterFontSize` dots when you need a size other than the default.
Also re-exported: `LABEL_PROFILES`, `mmToDots`, and `toText`.
See `@angadie/chittie-label` for the underlying builder, barcode types, and profiles.

## Spacing

A label is a **coordinate canvas**, not a flowing page: nothing wraps, nothing pushes
anything down, and `x`/`y` in dots is the only spacing control. Two elements overlap if
you give them overlapping coordinates — line height is yours to budget. Contrast this with
receipts (`@angadie/chittie-react`), where rows flow and wrapping is what costs paper.

Label *stock* length is fixed by the `profile` (`LABEL_PROFILES['40x30']` etc.), so a label
never runs long — content placed past the bottom edge falls outside the printed area. Convert with
`mmToDots(mm, dpi)` rather than hardcoding dots, or a layout tuned on a 203-DPI printer
lands at two-thirds scale on a 300-DPI one.
