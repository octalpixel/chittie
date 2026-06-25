# @angadie/chittie-label

## 0.6.2

### Patch Changes

- Updated dependencies [1d0e1f1]
- Updated dependencies [527f8b0]
  - @angadie/chittie-text@0.8.0

## 0.6.1

### Patch Changes

- Updated dependencies [5de524c]
  - @angadie/chittie-text@0.7.0

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

### Patch Changes

- Updated dependencies [4fc95fb]
  - @angadie/chittie-text@0.6.0

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
  - @angadie/chittie-text@0.5.0

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
  - @angadie/chittie-text@0.4.0
