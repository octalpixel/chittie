# @angadie/chittie-core

## 0.6.0

### Minor Changes

- 6f1fa0d: Control the line-feed pitch, and stop column-mode images feeding blank paper.

  `ESC @` leaves a printer on its default pitch of 1/6 inch (~34 dots at 203 DPI) while font A is only 24 dots tall, so every line spent ~10 dots of paper no layout asked for, with no way to tighten it — `<Br>` and `<Feed>` only ever add.

  - `encoder.lineSpacing(dots)` and `<Printer lineSpacing>` / `render({ lineSpacing })` set the pitch (`null` restores the printer default). A column-mode image restores the printer default when it finishes, which would silently undo the setting from the first image onward — on a non-Latin receipt that is every line — so the encoder now re-asserts it after each one.
  - Fixed the column-mode image band pitch: it emitted `ESC 3 0x24` (36 dots) for bands that are 24 dots tall, feeding 12 blank dots between every band of every image.
  - `chittie-preview` now models the pitch (`ESC 2` / `ESC 3 n`) instead of assuming a constant line height, so a mis-set pitch shows up in the preview instead of only on paper. `lineHeight` is now the default pitch that `ESC 2` restores.

  Measured on a 5-item 48-column receipt: a Latin receipt drops 52.8 mm to 37.8 mm, and a fully rasterized Sinhala receipt 54.1 mm to 37.8 mm.

## 0.5.3

### Patch Changes

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

## 0.5.2

### Patch Changes

- Centre and right alignment now pad after the line's leading command bytes, so
  the padding prints in the font it was measured against.

  `font('B')` widens the composer's column count and queues the font-select
  bytes, but the pad was placed at the head of the line — ahead of those bytes.
  The spaces were therefore sized in Font B cells and printed at Font A width,
  pushing a centred line right of centre by an amount that grew with the string
  length. `<Text align="center" small>` was visibly off-centre on real receipts.

  The same reordering puts the pad after a restored style, so a line following a
  double-width one is no longer padded at the previous line's character width.

## 0.5.1

### Patch Changes

- Add a `default` condition to every package's `exports` (alongside `import`). ESM-only exports
  (`"import"` only) made the packages unresolvable by CJS/tsx/jest resolvers
  (`ERR_PACKAGE_PATH_NOT_EXPORTED`); `default` makes them resolvable everywhere without changing the
  ESM output.
- Updated dependencies
  - @angadie/chittie-codepage@0.5.1

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
