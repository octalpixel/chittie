# @angadie/chittie-core

The ESC/POS / StarLine / StarPRNT builder engine behind chittie — a `ReceiptPrinterEncoder` with a fluent API that produces `Uint8Array` printer bytes.

> **Vendored** from [`NielsLeenheer/ReceiptPrinterEncoder`](https://github.com/NielsLeenheer/ReceiptPrinterEncoder) @ `939d303` (MIT). We ship its ESM source directly (no build step) so it stays editable. See [`VENDOR.md`](../../VENDOR.md) for the snapshot/sync policy. Most apps use it via [`@angadie/chittie`](../chittie); install this directly only for the raw builder.

## What we changed vs upstream
- Code-page dependency repointed to [`@angadie/chittie-codepage`](../chittie-codepage).
- A `structuredClone` polyfill guard (in our `src/index.js`, not the vendored algorithm) for older Hermes / React Native.
- `@canvas/image-data` pinned `≥1.1.0` (its `react-native` entry — needed for `image()` on RN).

## Install

```bash
pnpm add @angadie/chittie-core
```

## Usage

```ts
import ReceiptPrinterEncoder from '@angadie/chittie-core';

const bytes = new ReceiptPrinterEncoder({ columns: 48 })
  .initialize()
  .align('center').bold(true).line('Artisan Haus').bold(false)
  .rule()
  .table(
    [{ width: 36, align: 'left' }, { width: 12, align: 'right' }],
    [['Flat White', 'Rs. 850']]
  )
  .barcode('012345678905', 'ean13', 60)
  .qrcode('https://example.lk')
  .pulse()   // cash drawer
  .cut()
  .encode(); // Uint8Array
```

Key methods: `initialize`, `text`, `line`, `newline`, `bold`, `underline`, `invert`, `align`, `size`, `font`, `table`, `rule`, `box`, `barcode`, `qrcode`, `pdf417`, `image`, `pulse`, `cut`, `raw`, `encode`. Full reference: the upstream docs (this is a faithful snapshot).

## Non-Latin scripts
`text()` uses code pages, so Sinhala/Tamil become `?`. Use [`@angadie/chittie-text`](../chittie-text) to detect and rasterize them via `image()`.

## License

MIT — retains the upstream copyright (see `LICENSE`).
