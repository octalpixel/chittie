# @angadie/chittie-text

## 0.9.0

### Minor Changes

- ec3cbe3: Layout elements: `<Columns>`/`<Column>`, `<Box>`, `<Row gap>`, `<Line style|width>`.

  `chittie-core`'s builder has always had per-column widths, margins, padding and
  borders through `table()` and `box()`, but the JSX layer exposed none of it —
  `<Row>` hard-coded a two-column split and `<Line>` took no options. A receipt
  could not indent a wrapped line, size a column, or keep a guaranteed gap
  between a label and its amount.

  - `<Row gap>` keeps blank characters between the two cells. Without it a label
    that exactly fills the remaining width sits flush against the value with
    nothing between them; a gap wraps the label one character sooner instead.
    `<Row marginLeft|marginRight>` inset the whole row.
  - `<Columns>` with `<Column width|align|verticalAlign|marginLeft|marginRight>`
    is the general form. Leave `width` off one column and it takes the remainder.
    A cell wraps inside its own width, so a continuation line stays under its
    column instead of falling back to the left margin.
  - `<Box>` gives an indented block with optional padding and a border. It is the
    only way to indent — leading whitespace is stripped from `<Text>` and `<Row>`.
    It defaults to `style="none"`; the builder's `box()` defaults to `single`.
  - `<Line style="double">` and `<Line width>`.

  `chittie-text` gains `rasterizeColumns`, the N-column form of `rasterizeRow`.
  The engine refuses an image inside a table cell, so a row carrying Sinhala,
  Tamil or Arabic cannot be assembled per-cell; `<Columns>` detects it and
  rasterizes the whole row instead, the same way `<Row>` already did. `blit` now
  clips to the destination, so an over-wide fragment can no longer spill into the
  next row of the buffer.

  `chittie-core` fixes three defects that made those options unusable from the
  builder as well: `table()` and `box()` threw on the `align` they document as
  optional, and `box()` derived its default width without allowing for its own
  margins, so `box({marginLeft: 2})` always threw "Box is too wide".

## 0.8.1

### Patch Changes

- Add a `default` condition to every package's `exports` (alongside `import`). ESM-only exports
  (`"import"` only) made the packages unresolvable by CJS/tsx/jest resolvers
  (`ERR_PACKAGE_PATH_NOT_EXPORTED`); `default` makes them resolvable everywhere without changing the
  ESM output.
- Updated dependencies
  - @angadie/chittie-codepage@0.5.1

## 0.8.0

### Minor Changes

- 1d0e1f1: Add `cacheRasterizer(inner, maxEntries?)` — an LRU-memoizing wrapper around a `TextRasterizer`
  so repeated `(text, options)` pairs (the same header/greeting/labels on every receipt) are
  shaped once and reused. Upstreams the logo/raster-caching pattern ordereka built app-side.
- 527f8b0: RTL/bidi support for rows. `rasterizeRow` and `<Row>` take `rtl` — the label reads flush-right
  and the value flush-left (Arabic/Hebrew reading order), mirroring both the raster and code-page
  table paths. Arabic/RTL text should be rasterized (the canvas/Skia backend shapes joining forms
  and bidi); see docs/i18n.md for code-page selection guidance (Thai cp874, Japanese shiftjis, …).

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
