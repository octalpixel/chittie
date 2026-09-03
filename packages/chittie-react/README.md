# @angadie/chittie-react

Pure JSX receipt authoring → ESC/POS bytes. **RN-safe**: no `react-dom`, no HTML host elements — components render straight onto the [`chittie-core`](../chittie-core) builder, so the same `<Printer>` tree works on web and React Native.

> Most apps install [`@angadie/chittie`](../chittie) (which re-exports this). Install this directly only if you don't want the builder re-export.

## Install

```bash
pnpm add @angadie/chittie-react react
```

## Usage

```tsx
import { Printer, Text, Row, Line, Cut, render } from '@angadie/chittie-react';

const bytes = render(
  <Printer width={48}>
    <Text align="center" bold size={{ width: 2, height: 2 }}>SHOP</Text>
    <Line />
    <Row left="Item" right="Rs. 100" />
    <Cut />
  </Printer>
);
// bytes: Uint8Array — hand to any transport
```

`render(element, options?)` returns a `Uint8Array`. It is synchronous and pure.

### `render` options

| Option | Default | What it does |
|---|---|---|
| `columns` | `48` | Characters per line. **Overridden by `<Printer width>`** if that is set. |
| `dotWidth` | `columns × 12` | Printable width in dots. Only used when rasterizing — it is the width non-Latin text and rows are laid out against. |
| `dpi` | `203` | Printer resolution. Keeps rasterized text the same *physical* size on a 203- and a 300-DPI printer. |
| `fontFamilies` | — | Ordered font fallback chain handed to the rasterizer, e.g. `['Noto Sans Sinhala']`. |
| `rasterizer` | — | Supply to print non-encodable scripts as images. Without it, such text **throws**. |
| `codepage` | `'cp437'` | What counts as "encodable as text"; everything else is rasterized. |

`PRINTER_PROFILES` carries the three that must agree for a given paper size — pass one
instead of hand-computing `dotWidth`:

```tsx
import { render, PRINTER_PROFILES } from '@angadie/chittie-react';

render(<Receipt />, { ...PRINTER_PROFILES['58mm'], rasterizer });
```

| Profile | columns | dotWidth | dpi |
|---|---|---|---|
| `'58mm'` | 32 | 384 | 203 |
| `'80mm'` | 48 | 576 | 203 |
| `'58mm-300'` | 48 | 576 | 300 |
| `'80mm-300'` | 72 | 864 | 300 |

### Also exported

Receipt-content helpers, re-exported from [`@angadie/chittie-text`](../chittie-text) so one
import covers authoring:

| Export | Use |
|---|---|
| `formatMoney(amount, options?)` | RN-safe money formatting — **no `Intl`**, so it behaves the same on Hermes |
| `foldTypographic(text)` | `×` `–` `'` `"` `…` → receipt-safe ASCII |
| `sanitizeControl(text)` | strips control characters that would corrupt the byte stream |
| `needsRaster(text, codepage?)` | `true` if the code page can't represent the text (i.e. it must be rasterized) |
| `dotsPerMm(dpi?)` | dots-per-mm for a resolution, for sizing images |
| `toText(node)` | the same pure text extraction `<Text>` uses on its children |

## Components

| Component | Props | Emits |
|---|---|---|
| `<Printer>` | `width` (columns, default 48) | the root; sets line width |
| `<Text>` | `align`, `bold`, `underline` (`true` or a thickness `1`/`2`), `invert`, `size` ({width,height} multipliers), `small`, `inline` | text (or image — see below) + newline |
| `<Row>` | `left`, `right`, `rtl`, `gap`, `marginLeft`, `marginRight` | a two-column justified row (`rtl`: label flush-right, value flush-left) |
| `<Table>` | `columns` (**required**, `TableColumn[]`), `rows` (**required**, `ReactNode[][]`), `gap` | rows sharing one set of columns |
| `<Columns>` | `gap` | a one-off row of `<Column>` cells |
| `<Column>` | `width`, `align`, `verticalAlign`, `marginLeft`, `marginRight` | one cell; omit `width` on one column to take the remainder |
| `<Box>` | `style` (default `none`), `width`, `align`, `marginLeft`, `marginRight`, `paddingLeft`, `paddingRight` | an indented block, optionally bordered |
| `<Line>` | `style` (`single`/`double`), `width` | a horizontal rule |
| `<Br>` | `lines` (default 1) | blank line(s) |
| `<Feed>` | `dots` (**required**, clamped 0–255) | precise vertical space (ESC J) — finer than `<Br>` |
| `<Cut>` | `partial` | paper cut |
| `<Cashdraw>` | `device` | cash-drawer kick pulse |
| `<Barcode>` | `value` (**required**), `symbology` (default `code128`), `height` | a barcode |
| `<QRCode>` | `value` (**required**), `size`, `model` | a QR code |
| `<Image>` | `image` (**required**, ImageData), `align`, `dither`, `threshold`, `width`, `height` | a raster image (logo, etc.) |

A `TableColumn` (each entry of `<Table columns>`) takes:

| Field | Meaning |
|---|---|
| `width` | `number` — exactly that many characters. `'auto'` — fit the widest cell in this column, across every row. Omitted — flexible: takes whatever the other columns leave (at most one column may be flexible). |
| `align` | `left` \| `center` \| `right` |
| `verticalAlign` | `top` (default) \| `bottom` — where a short cell sits when a sibling wraps to several lines |
| `marginLeft` / `marginRight` | blank characters kept outside the column |

**Spacing & fine print:** `<Br lines>` adds blank lines; `<Feed dots>` adds dot-precise space (ESC J);
`<Text small>` prints in the smaller **Font B** (~9×17 vs A 12×24) for footers / "Powered by…" lines —
and `chittie-preview` renders it smaller too. For RTL rows (Arabic/Hebrew) pass `<Row rtl>`.
See [Vertical spacing](#vertical-spacing--how-much-paper-a-receipt-uses) for why a receipt runs long
and which knob shortens it.

### Layout — columns, gaps, indentation

Receipt layout is a character grid, not a pixel canvas: text is positioned to
the character, never to the dot. Within that grid you get columns, margins,
padding, indentation and borders.

**`<Row gap>` — never let a value touch its label.** `<Row>` gives the right
cell its natural width and the left cell whatever remains, so a label that
exactly fills the line ends up flush against the value:

```tsx
<Row left="1x Raththi milk powder" right="Rs. 120.00" />
// 1x Raththi milk powderRs. 120.00     ← 22 + 10 == 32 exactly

<Row left="1x Raththi milk powder" right="Rs. 120.00" gap={1} />
// 1x Raththi milk       Rs. 120.00
// powder
```

**`<Table>` — repeated rows, columns declared once.** Use it wherever a receipt
repeats a line shape. `width: 'auto'` sizes a column to its widest cell across
every row, which `<Columns>` cannot do — it only ever sees one row:

```tsx
<Table
  gap={1}
  columns={[{ width: 3 }, {}, { width: 'auto', align: 'right' }]}
  rows={items.map((it) => [`${it.qty}x`, it.name, money(it.total)])}
/>
// 1x  Raththi milk powder                 Rs. 120.00
// 2x  Almond croissant with salted      Rs. 1,300.00
//     caramel
```

Cells take plain strings or any printable node. Only one column may omit
`width`; it absorbs the remainder. A row whose text needs rasterizing becomes a
single image while the other rows stay as text, and the row order is preserved.

**`<Columns>` — a one-off row.** Same column options, spelled as children, for
a line that does not repeat:

```tsx
<Columns gap={1}>
  <Column width={3}>2x</Column>
  <Column>Flat White</Column>
  <Column width={12} align="right">Rs. 1,700.00</Column>
</Columns>
```

A bare string child prints as its own line, so a cell needs no `<Text>` wrapper
unless you want to style it.

**`<Box>` — the only way to indent.** Leading whitespace is stripped from
`<Text>` and `<Row>`, so spaces cannot indent anything. A box can:

```tsx
<Box marginLeft={3}>
  <Row left="+ Hand embroidery on neckline and cuffs" right="Rs. 8,000.00" gap={1} />
</Box>
```

It defaults to `style="none"` — a layout element, with a border you opt into.
(The builder's `box()` defaults to `single`.) Give it `style="single"`,
`paddingLeft` and `paddingRight` for a bordered notice.

**Non-Latin inside a cell.** The engine refuses an image inside a table cell,
so a row carrying Sinhala, Tamil or Arabic cannot be assembled per-cell.
`<Columns>` detects it and rasterizes the whole row through the rasterizer you
passed to `render()`, exactly as `<Row>` does — per-cell styling does not
survive that path, and the cell text does. `<Box>` has no such fallback:
non-Latin text inside a `<Box>` throws.

### Vertical spacing — how much paper a receipt uses

**chittie never inserts blank space between rows.** A `<Row>`, a `<Columns>`, and each
row of a `<Table>` cost exactly as many printed lines as their *tallest cell after
wrapping* — nothing is added in between. So if a receipt looks loosely spaced, the
paper is going to one of four places, and only the first is under your control per-row:

| Where the paper goes | Cost | Knob |
|---|---|---|
| A cell **wrapped** onto a second/third line | +1 line each | column widths, `gap`, shorter text |
| `<Br lines>` / `<Feed dots>` you wrote | 1 line / *n* dots | remove them |
| `<Box style="single">` borders | +2 lines | `style="none"` (the default) |
| The printer's own **line pitch** | ~1/6 in (≈34 dots @ 203 DPI) per line, vs a 24-dot glyph | none today — see below |

**Wrapping is almost always the answer.** A column narrower than its content silently
becomes a two- or three-line row, and a table of 20 items pays that 20 times:

```tsx
// 32 columns (58mm). "Almond croissant" is 16 chars, the price 11 — plus gap 1 = 28.
// Give the name only 12 and every long item wraps:
<Table columns={[{ width: 3 }, { width: 12 }, { width: 'auto', align: 'right' }]} rows={rows} gap={1} />
// 1x  Almond            Rs. 1,300.00
//     croissant                        ← 2 lines per item

// Let the name column flex into whatever is left — one line per item:
<Table columns={[{ width: 3 }, {}, { width: 'auto', align: 'right' }]} rows={rows} gap={1} />
// 1x  Almond croissant  Rs. 1,300.00
```

Rules of thumb for keeping rows to one line:

- **Leave exactly one column without a `width`** so it absorbs the remainder instead of
  wrapping at a width you guessed.
- **`width: 'auto'`** on the price column sizes it to the widest price across every row —
  no character is wasted on a column that never needs it.
- **`gap` costs a character and makes wrapping likelier.** It exists so a full-width label
  can't touch its value; on a 32-column receipt `gap={1}` is often the character that pushes
  a long item onto a second line. Drop it where the columns already separate cleanly.
- **`<Row>` gives the right cell its natural width and the left cell whatever remains** —
  so a long right-hand value (`Rs. 1,300.00`, 12 chars) is what wraps the label. Shorten the
  value (`1,300.00`) before you shorten the label.

**What does *not* save vertical space:** `<Text small>` (Font B) makes glyphs *narrower and
shorter*, but the printer still advances one full line — it buys horizontal room, not paper
length. Wrapping is decided in characters, and the column count doesn't change with the font,
so `small` won't unwrap a row either.

**Rasterized (non-Latin) rows are tighter, not looser.** A Sinhala/Tamil row prints as one
image and advances by exactly the image height — about **3 mm** per line (scaled by `size.height`,
and by 0.72 for `small`), with no line feed after it. That is *less* than a text line's ~1/6 in
pitch. If a non-Latin receipt runs long, the height is coming from the `ImageData` your
rasterizer returns: a rasterizer that bakes in generous leading, or an image padded to a
multiple of 8 (an ESC/POS requirement), makes every line taller. Measure `img.height` before
blaming chittie.

**The one thing you cannot tune today** is the printer's default line pitch. `initialize()`
sends `ESC @`, which resets the printer to its default ~1/6 in (≈34 dots at 203 DPI) while
font A is only 24 dots tall — roughly 1.2 mm of leading on every single line, or ~5 cm over a
40-line receipt. chittie exposes no line-spacing command: `<Br>` and `<Feed>` can only *add*
space. Tightening it needs `ESC 3 n`, which is not wired up — [open an issue](../../issues) if
you need it.

### `<Image>` — logos and bitmaps

Pass `ImageData` (from a `<canvas>`, a decoded PNG, or a rasterizer). Dimensions are auto-padded to multiples of 8 (the ESC/POS raster requirement), so any size works. Use `dither="threshold"` for crisp line-art/logos, or `floydsteinberg`/`atkinson` for photos.

```tsx
const logo = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
render(
  <Printer width={48}>
    <Image image={logo} align="center" dither="threshold" />
    <Text align="center" bold>ARTISAN HAUS</Text>
  </Printer>
);
```

User-defined wrapper components are supported — `render` walks function components and fragments.

## Custom components

Compose your own components — they're plain functions returning chittie elements. `render` invokes them and walks their output, so `.map()`, fragments, and conditionals all work:

```tsx
const LineItem = ({ name, qty, price }: Item) => (
  <Row left={`${qty}x ${name}`} right={`Rs. ${qty * price}`} />
);

function Receipt({ items }: { items: Item[] }) {
  return (
    <Printer width={48}>
      <Text align="center" bold>MY SHOP</Text>
      <Line />
      {items.map((it) => <LineItem key={it.id} {...it} />)}
      {items.length === 0 && <Text align="center">No items</Text>}
      <Cut />
    </Printer>
  );
}

// a whole receipt can be ONE component — render resolves it down to <Printer>
render(<Receipt items={cart} />);
```

**Constraints** (it's a pure renderer, not the React reconciler):
- Components must be pure `props → elements`. **No hooks** (`useState`/`useEffect`/`useContext`) and no `react-dom` — there's no component tree, state, or lifecycle, by design (a receipt is a one-shot render).
- `<Text>` accepts only **text** (strings/numbers). Nesting a component (`<Text><Row/></Text>`) **throws a clear error** — put `<Row>`, `<Image>`, etc. as siblings. (Fragments wrapping text are fine.)

## Non-Latin scripts (Sinhala / Tamil / …)

`<Text>` content that a code page can't represent is auto-rasterized **when you pass a rasterizer**; otherwise `render` throws (never a silent `?`). See [`@angadie/chittie-text`](../chittie-text).

```tsx
render(<Printer><Text>ආයුබෝවන්</Text></Printer>, {
  ...PRINTER_PROFILES['58mm'],           // columns + dotWidth + dpi, kept in agreement
  rasterizer: myRasterizer,              // TextRasterizer
  fontFamilies: ['Noto Sans Sinhala'],   // fallback chain for the rasterizer
  codepage: 'cp437',                     // what counts as "encodable as text"
});
```

`dotWidth` and `dpi` matter here: they are what keeps rasterized text the same physical
size across 58/80mm and 203/300-DPI printers. Get them from `PRINTER_PROFILES` rather
than by hand — a `dotWidth` that disagrees with `columns` lays non-Latin rows out against
the wrong paper width.

## License

MIT.
