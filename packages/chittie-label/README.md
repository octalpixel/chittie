# @angadie/chittie-label

**TSPL label & tag printing for chittie** — barcodes, QR, text, boxes, and rasterized
images (including non-Latin scripts) on coordinate-positioned labels. Universal
(web / React Native / Node), Buffer-free.

chittie's receipt packages speak **ESC/POS** (line-flow receipts). Label printers —
fashion price tags, jewellery tags, shelf labels — speak **TSPL** (TSC/Zebra/Gprinter
and most cheap label printers), which is **coordinate-based**: you place each element at
an `(x, y)` in dots. This package builds correct TSPL byte streams from a small builder.

```bash
npm i @angadie/chittie-label
```

## Quick start — a garment price tag

```ts
import { label, LABEL_PROFILES } from '@angadie/chittie-label';

const b = label({ ...LABEL_PROFILES['40x30'], density: 8, speed: 4 }); // 40×30mm @203dpi
const bytes = b
  .box(0, 0, b.mm(40), b.mm(30), 2)                       // border
  .text(b.mm(2), b.mm(2), 'ARTISAN HAUS', { font: '3' })  // brand slot
  .text(b.mm(2), b.mm(9), 'Rs. 4,500', { font: '4', xMul: 2, yMul: 2 }) // price slot
  .barcode(b.mm(2), b.mm(16), '4791234567890', { type: 'ean13', height: 50 }) // barcode slot
  .qrcode(b.mm(28), b.mm(2), 'https://shop.lk/p/SKU123', { cell: 4 })         // QR slot
  .encode({ copies: 2 });

// bytes : Uint8Array — send via any chittie transport (Web Serial / BLE / Tauri / TCP)
```

## Design slots

TSPL is positional, so a "slot" is just a positioned element. Put coordinates in **dots**
(`b.mm(n)` converts mm → dots for the profile's DPI). Lay out a template once, then fill
the slots per product. Common slots on a price tag: **brand**, **product name**
(`block()` for wrapping), **price** (magnified `text`), **barcode**, **QR**, **SKU/size**.

## API

`label(profile, { rasterizer? })` → builder with:

| method | TSPL | notes |
|---|---|---|
| `text(x, y, value, opts?)` | `TEXT` | `font` "1"–"5", `rotation`, `xMul`/`yMul`. Non-Latin → rasterized (needs `rasterizer`) or throws. |
| `barcode(x, y, data, opts?)` | `BARCODE` | `type`, `height`, `human` (0/1/2), `narrow`/`wide`. |
| `qrcode(x, y, data, opts?)` | `QRCODE` | `ecc` L/M/Q/H, `cell` 1–10. |
| `box(x, y, w, h, thickness?)` | `BOX` | outline rectangle. |
| `bar(x, y, w, h)` | `BAR` | filled bar/line. |
| `image(x, y, imageData, opts?)` | `BITMAP` | 1-bit raster (logos / any `ImageData`). |
| `raw(line)` | — | append a raw TSPL command. |
| `encode({ sets?, copies? })` | `SIZE`/`GAP`/…/`CLS`/…/`PRINT` | → `Uint8Array`. |

### Barcodes
`code128` (default), `code128m`, `ean128`, `code39`, `code93`, `ean13`, `ean8`, `upca`,
`upce`, `codabar`, `itf14`, `interleaved25`, `msi`. (For retail/apparel: **EAN-13** for
retail GTINs, **Code128** for internal SKUs, **QR** for links/rich data.)

### Profiles & sizes
`LABEL_PROFILES`: `40x30`, `50x30`, `30x20`, `50x25`, `60x40` (mm). Or pass
`{ widthMm, heightMm, gapMm?, dpi?, speed?, density?, direction?, codepage?, reference? }`.
`gapMm: 0` = continuous stock. `dpi: 300` for 300-DPI printers (12 dots/mm).

### Non-Latin (Sinhala/Tamil/…)
TSPL's internal fonts can't shape complex scripts, so `text()` with non-encodable content
is **rasterized to a `BITMAP`** via an injected `rasterizer` (same pattern as chittie-text)
— or throws if none is supplied (never a silent `?`).

```ts
label(profile, { rasterizer: myCanvasRasterizer }).text(x, y, 'සිල්ක් සාරිය');
```

### Printing
`encode()` returns `Uint8Array` — hand it to any chittie transport: Web Serial /
`@angadie/chittie-transport-web`, BLE / `@angadie/chittie-transport-react-native`, a Tauri
`print_escpos`-style command, or raw TCP. (TSPL printers take raw bytes just like ESC/POS.)

> A JSX `<Label>` surface (mirroring chittie-react) is planned as `@angadie/chittie-label-react`.

> **Verify on hardware:** BITMAP bit-polarity (dark→0, light→1, MSB-first) follows the TSPL
> convention and is unit-tested, but confirm a logo prints right-side-out on your printer.
