# @angadie/chittie-react

## 0.13.0

### Minor Changes

- 6f1fa0d: Control the line-feed pitch, and stop column-mode images feeding blank paper.

  `ESC @` leaves a printer on its default pitch of 1/6 inch (~34 dots at 203 DPI) while font A is only 24 dots tall, so every line spent ~10 dots of paper no layout asked for, with no way to tighten it — `<Br>` and `<Feed>` only ever add.

  - `encoder.lineSpacing(dots)` and `<Printer lineSpacing>` / `render({ lineSpacing })` set the pitch (`null` restores the printer default). A column-mode image restores the printer default when it finishes, which would silently undo the setting from the first image onward — on a non-Latin receipt that is every line — so the encoder now re-asserts it after each one.
  - Fixed the column-mode image band pitch: it emitted `ESC 3 0x24` (36 dots) for bands that are 24 dots tall, feeding 12 blank dots between every band of every image.
  - `chittie-preview` now models the pitch (`ESC 2` / `ESC 3 n`) instead of assuming a constant line height, so a mis-set pitch shows up in the preview instead of only on paper. `lineHeight` is now the default pitch that `ESC 2` restores.

  Measured on a 5-item 48-column receipt: a Latin receipt drops 52.8 mm to 37.8 mm, and a fully rasterized Sinhala receipt 54.1 mm to 37.8 mm.

- 5fb943b: Remove the unused `type` prop from `PrinterProps`. `render()` only ever read `<Printer width>`; `type` was never forwarded to the encoder, so setting it did nothing.

### Patch Changes

- Updated dependencies [6f1fa0d]
  - @angadie/chittie-core@0.6.0
  - @angadie/chittie-text@0.9.0

## 0.12.0

### Minor Changes

- e63bf48: `<Table>` — rows that share one set of columns, and content-sized columns.

  `<Columns>` describes a single row, so every repeated line has to restate the
  same widths and nothing enforces that they match. `<Table>` declares the
  columns once and takes `rows`, so a repeated line shape is aligned by
  construction.

  It also adds `width: 'auto'`, which sizes a column to its widest cell across
  every row. That cannot be expressed with `<Columns>` — a single row cannot know
  what the others contain — so every consumer was computing it by hand:

  ```tsx
  <Table
    gap={1}
    columns={[{ width: 3 }, {}, { width: "auto", align: "right" }]}
    rows={items.map((it) => [`${it.qty}x`, it.name, money(it.total)])}
  />
  ```

  Cells accept plain strings or printable nodes. A row needing raster becomes one
  image while the rest stay text, in the order written.

  Also fixes a defect in 0.11.0: a bare string child was silently dropped, so
  `<Column>2x</Column>` and `<Box>Thank you</Box>` printed nothing unless the
  text was wrapped in `<Text>`. Strings now print as their own line.

## 0.11.0

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

### Patch Changes

- Updated dependencies [ec3cbe3]
  - @angadie/chittie-text@0.9.0
  - @angadie/chittie-core@0.5.3

## 0.10.2

### Patch Changes

- Updated dependencies
  - @angadie/chittie-core@0.5.2
  - @angadie/chittie-text@0.8.1

## 0.10.1

### Patch Changes

- Add a `default` condition to every package's `exports` (alongside `import`). ESM-only exports
  (`"import"` only) made the packages unresolvable by CJS/tsx/jest resolvers
  (`ERR_PACKAGE_PATH_NOT_EXPORTED`); `default` makes them resolvable everywhere without changing the
  ESM output.
- Updated dependencies
  - @angadie/chittie-core@0.5.1
  - @angadie/chittie-text@0.8.1

## 0.10.0

### Minor Changes

- 7251e5b: `<Text small>` selects the printer's smaller built-in font (ESC/POS **Font B**, ~9×17 vs Font A
  12×24) — for receipt footers / "Powered by …" fine print. Composes with `align`/`bold`; non-Latin
  `small` text shrinks its raster to match. chittie-preview now honors Font B (`ESC M`), so the
  on-screen preview matches the print.

## 0.9.0

### Minor Changes

- 14c7870: Add `<Feed dots={n}>` — precise one-shot vertical spacing (ESC J), finer than `<Br lines>`.
  It doesn't touch global line spacing (so no conflict with the image feed), giving consumers a
  clean way to tune gaps. Note: `<Text size>` is character magnification (1–8), not line spacing;
  spacing control is `<Br lines>` (line-level) + `<Feed dots>` (dot-level) + `<Text inline>`.

## 0.8.0

### Minor Changes

- 527f8b0: RTL/bidi support for rows. `rasterizeRow` and `<Row>` take `rtl` — the label reads flush-right
  and the value flush-left (Arabic/Hebrew reading order), mirroring both the raster and code-page
  table paths. Arabic/RTL text should be rasterized (the canvas/Skia backend shapes joining forms
  and bidi); see docs/i18n.md for code-page selection guidance (Thai cp874, Japanese shiftjis, …).

### Patch Changes

- Updated dependencies [1d0e1f1]
- Updated dependencies [527f8b0]
  - @angadie/chittie-text@0.8.0

## 0.7.0

### Minor Changes

- 5de524c: Fix double-spacing of non-Latin lines. `smartText` now returns whether it rasterized;
  `<Text>` skips its trailing line-feed when the content was rasterized (a raster image
  already advances the paper, so feeding again double-spaced every Sinhala/Tamil line).

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
  - @angadie/chittie-core@0.5.0
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
  - @angadie/chittie-core@0.4.0
  - @angadie/chittie-text@0.4.0

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
  - @angadie/chittie-text@0.3.0

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
  - @angadie/chittie-text@0.2.0

## 0.1.1

### Patch Changes

- Establish the changesets release pipeline: publish via `pnpm -r publish` so
  `workspace:*` internal deps are rewritten to real versions (changeset publish
  does not strip the workspace protocol). No package-code changes.
- Updated dependencies
  - @angadie/chittie-core@0.1.1
  - @angadie/chittie-text@0.1.1
