# @angadie/chittie-preview

## 0.7.0

### Minor Changes

- 7251e5b: `<Text small>` selects the printer's smaller built-in font (ESC/POS **Font B**, ~9×17 vs Font A
  12×24) — for receipt footers / "Powered by …" fine print. Composes with `align`/`bold`; non-Latin
  `small` text shrinks its raster to match. chittie-preview now honors Font B (`ESC M`), so the
  on-screen preview matches the print.

## 0.6.0

### Minor Changes

- 768679e: Add `renderLabel(bytes, options)` — render the TSPL bytes from `@angadie/chittie-label`
  (or `chittie-label-react`) to a canvas: `SIZE`-driven dimensions, positioned `TEXT`,
  `BOX`, `BAR`, `BITMAP` (correct bit polarity), and representative `BARCODE`/`QRCODE`
  previews. Same injected-canvas pattern as `renderReceipt` (browser or @napi-rs/canvas).

## 0.5.0

### Minor Changes

- 3d54f57: New package **`@angadie/chittie-label-react`**: pure JSX authoring for TSPL labels. A
  `<Label>` root with coordinate-positioned `<LText>`, `<LBarcode>`, `<LQR>`, `<LBox>`,
  `<LBar>`, `<LImage>` — mirrors `@angadie/chittie-react` (no react-dom, RN-safe) and renders
  onto `@angadie/chittie-label`. Non-Latin `<LText>` rasterizes via an injected rasterizer.
  chittie-label also now re-exports `TextRasterizer`/`RasterOptions`.

## 0.4.0

### Minor Changes

- dbd6711: New package **`@angadie/chittie-label`**: TSPL label/tag printing for chittie. A
  coordinate-based builder for fashion/retail labels — positioned `text`, `barcode`
  (EAN-13/Code128/Code39/UPC/…), `qrcode`, `box`, `bar`, and `image` (1-bit BITMAP).
  Non-Latin text rasterizes via an injected rasterizer (reusing chittie-text); never a
  silent `?`. RN-safe / Buffer-free; returns `Uint8Array` for any chittie transport.

## 0.3.0

### Minor Changes

- d80ae2c: Add `formatMoney` (RN-safe money formatting — pure `toFixed` + regex grouping, no
  `Intl`, so grouping survives on Hermes where `Number.toLocaleString` silently drops it)
  and `sanitizeControl` (strip C0/DEL control bytes from user text so a product/customer
  name can't inject or corrupt ESC/POS commands). `<Text>` and `<Row>` sanitize then fold
  before encoding. Both helpers are exported from `@angadie/chittie`.

## 0.2.0

### Minor Changes

- 3af3f74: Fold common typographic punctuation to ASCII before code-page encoding, so
  receipts no longer throw on ubiquitous characters. `× → x`, `— – − → -`,
  `' ' → '`, `" " → "`, `… → ...`, `• → *` (the last also avoids cp437's 0x07/BEL).
  `<Text>` (via `smartText`) and `<Row>` both fold; truly non-Latin scripts
  (Sinhala/Tamil) still raster or throw as before. New export: `foldTypographic`.

## 0.1.1

### Patch Changes

- Establish the changesets release pipeline: publish via `pnpm -r publish` so
  `workspace:*` internal deps are rewritten to real versions (changeset publish
  does not strip the workspace protocol). No package-code changes.
