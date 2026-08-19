# @angadie/chittie

## 0.5.8

### Patch Changes

- Updated dependencies [ec3cbe3]
  - @angadie/chittie-react@0.11.0
  - @angadie/chittie-core@0.5.3

## 0.5.7

### Patch Changes

- Updated dependencies
  - @angadie/chittie-core@0.5.2
  - @angadie/chittie-react@0.10.2

## 0.5.6

### Patch Changes

- Add a `default` condition to every package's `exports` (alongside `import`). ESM-only exports
  (`"import"` only) made the packages unresolvable by CJS/tsx/jest resolvers
  (`ERR_PACKAGE_PATH_NOT_EXPORTED`); `default` makes them resolvable everywhere without changing the
  ESM output.
- Updated dependencies
  - @angadie/chittie-core@0.5.1
  - @angadie/chittie-react@0.10.1

## 0.5.5

### Patch Changes

- Updated dependencies [7251e5b]
  - @angadie/chittie-react@0.10.0

## 0.5.4

### Patch Changes

- Updated dependencies [14c7870]
  - @angadie/chittie-react@0.9.0

## 0.5.3

### Patch Changes

- Updated dependencies [527f8b0]
  - @angadie/chittie-react@0.8.0

## 0.5.2

### Patch Changes

- Updated dependencies [5de524c]
  - @angadie/chittie-react@0.7.0

## 0.5.1

### Patch Changes

- Updated dependencies [4fc95fb]
  - @angadie/chittie-react@0.6.0

## 0.5.0

### Minor Changes

- 3d54f57: New package **`@angadie/chittie-label-react`**: pure JSX authoring for TSPL labels. A
  `<Label>` root with coordinate-positioned `<LText>`, `<LBarcode>`, `<LQR>`, `<LBox>`,
  `<LBar>`, `<LImage>` — mirrors `@angadie/chittie-react` (no react-dom, RN-safe) and renders
  onto `@angadie/chittie-label`. Non-Latin `<LText>` rasterizes via an injected rasterizer.
  chittie-label also now re-exports `TextRasterizer`/`RasterOptions`.

### Patch Changes

- Updated dependencies [3d54f57]
  - @angadie/chittie-core@0.5.0
  - @angadie/chittie-react@0.5.0

## 0.4.0

### Minor Changes

- dbd6711: New package **`@angadie/chittie-label`**: TSPL label/tag printing for chittie. A
  coordinate-based builder for fashion/retail labels — positioned `text`, `barcode`
  (EAN-13/Code128/Code39/UPC/…), `qrcode`, `box`, `bar`, and `image` (1-bit BITMAP).
  Non-Latin text rasterizes via an injected rasterizer (reusing chittie-text); never a
  silent `?`. RN-safe / Buffer-free; returns `Uint8Array` for any chittie transport.

### Patch Changes

- Updated dependencies [dbd6711]
  - @angadie/chittie-core@0.4.0
  - @angadie/chittie-react@0.4.0

## 0.3.0

### Minor Changes

- d80ae2c: Add `formatMoney` (RN-safe money formatting — pure `toFixed` + regex grouping, no
  `Intl`, so grouping survives on Hermes where `Number.toLocaleString` silently drops it)
  and `sanitizeControl` (strip C0/DEL control bytes from user text so a product/customer
  name can't inject or corrupt ESC/POS commands). `<Text>` and `<Row>` sanitize then fold
  before encoding. Both helpers are exported from `@angadie/chittie`.

### Patch Changes

- Updated dependencies [d80ae2c]
  - @angadie/chittie-core@0.3.0
  - @angadie/chittie-react@0.3.0

## 0.2.0

### Minor Changes

- 3af3f74: Fold common typographic punctuation to ASCII before code-page encoding, so
  receipts no longer throw on ubiquitous characters. `× → x`, `— – − → -`,
  `' ' → '`, `" " → "`, `… → ...`, `• → *` (the last also avoids cp437's 0x07/BEL).
  `<Text>` (via `smartText`) and `<Row>` both fold; truly non-Latin scripts
  (Sinhala/Tamil) still raster or throw as before. New export: `foldTypographic`.

### Patch Changes

- Updated dependencies [3af3f74]
  - @angadie/chittie-core@0.2.0
  - @angadie/chittie-react@0.2.0

## 0.1.1

### Patch Changes

- Establish the changesets release pipeline: publish via `pnpm -r publish` so
  `workspace:*` internal deps are rewritten to real versions (changeset publish
  does not strip the workspace protocol). No package-code changes.
- Updated dependencies
  - @angadie/chittie-core@0.1.1
  - @angadie/chittie-react@0.1.1
