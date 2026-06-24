# @angadie/chittie-text

## 0.7.0

### Minor Changes

- 5de524c: Fix double-spacing of non-Latin lines. `smartText` now returns whether it rasterized;
  `<Text>` skips its trailing line-feed when the content was rasterized (a raster image
  already advances the paper, so feeding again double-spaced every Sinhala/Tamil line).

## 0.6.0

### Minor Changes

- 4fc95fb: dpi-aware rasterization + font fallback (cross-platform sizing):
  - `RasterOptions` gains `fontFamilies` (ordered fallback) and `dpi`; new `dotsPerMm(dpi)` export.
  - `PRINTER_PROFILES` carry `dpi` (+ 300-DPI presets); `render({ dpi, fontFamilies })` threads them.
    `<Text>`/`<Row>`/`<LText>` now derive rasterized font size from `mm × dotsPerMm(dpi) × size`, so
    non-Latin text is the same physical size on 58/80mm and 203/300-DPI; `maxWidth` = printable dots.
  - `createBestTransport()` (chittie-transport-web): deterministic capability pick —
    companion (any browser, USB/queue/network) → Web Serial (Chromium + serial) → clear error.
    Reports `{ kind }`; not a shotgun. The device is still explicitly pinned.

## 0.5.0

### Minor Changes

- 3d54f57: New package **`@angadie/chittie-label-react`**: pure JSX authoring for TSPL labels. A
  `<Label>` root with coordinate-positioned `<LText>`, `<LBarcode>`, `<LQR>`, `<LBox>`,
  `<LBar>`, `<LImage>` — mirrors `@angadie/chittie-react` (no react-dom, RN-safe) and renders
  onto `@angadie/chittie-label`. Non-Latin `<LText>` rasterizes via an injected rasterizer.
  chittie-label also now re-exports `TextRasterizer`/`RasterOptions`.

### Patch Changes

- Updated dependencies [3d54f57]
  - @angadie/chittie-codepage@0.5.0

## 0.4.0

### Minor Changes

- dbd6711: New package **`@angadie/chittie-label`**: TSPL label/tag printing for chittie. A
  coordinate-based builder for fashion/retail labels — positioned `text`, `barcode`
  (EAN-13/Code128/Code39/UPC/…), `qrcode`, `box`, `bar`, and `image` (1-bit BITMAP).
  Non-Latin text rasterizes via an injected rasterizer (reusing chittie-text); never a
  silent `?`. RN-safe / Buffer-free; returns `Uint8Array` for any chittie transport.

### Patch Changes

- Updated dependencies [dbd6711]
  - @angadie/chittie-codepage@0.4.0

## 0.3.0

### Minor Changes

- d80ae2c: Add `formatMoney` (RN-safe money formatting — pure `toFixed` + regex grouping, no
  `Intl`, so grouping survives on Hermes where `Number.toLocaleString` silently drops it)
  and `sanitizeControl` (strip C0/DEL control bytes from user text so a product/customer
  name can't inject or corrupt ESC/POS commands). `<Text>` and `<Row>` sanitize then fold
  before encoding. Both helpers are exported from `@angadie/chittie`.

### Patch Changes

- Updated dependencies [d80ae2c]
  - @angadie/chittie-codepage@0.3.0

## 0.2.0

### Minor Changes

- 3af3f74: Fold common typographic punctuation to ASCII before code-page encoding, so
  receipts no longer throw on ubiquitous characters. `× → x`, `— – − → -`,
  `' ' → '`, `" " → "`, `… → ...`, `• → *` (the last also avoids cp437's 0x07/BEL).
  `<Text>` (via `smartText`) and `<Row>` both fold; truly non-Latin scripts
  (Sinhala/Tamil) still raster or throw as before. New export: `foldTypographic`.

### Patch Changes

- Updated dependencies [3af3f74]
  - @angadie/chittie-codepage@0.2.0

## 0.1.1

### Patch Changes

- Establish the changesets release pipeline: publish via `pnpm -r publish` so
  `workspace:*` internal deps are rewritten to real versions (changeset publish
  does not strip the workspace protocol). No package-code changes.
- Updated dependencies
  - @angadie/chittie-codepage@0.1.1
