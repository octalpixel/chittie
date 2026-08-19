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

## Components

| Component | Props | Emits |
|---|---|---|
| `<Printer>` | `width` (columns, default 48) | the root; sets line width |
| `<Text>` | `align`, `bold`, `underline`, `invert`, `size` ({width,height} multipliers), `small`, `inline` | text (or image — see below) + newline |
| `<Row>` | `left`, `right`, `rtl`, `gap`, `marginLeft`, `marginRight` | a two-column justified row (`rtl`: label flush-right, value flush-left) |
| `<Table>` | `columns`, `rows`, `gap` | rows sharing one set of columns; `width: 'auto'` fits a column to its content |
| `<Columns>` | `gap` | a one-off row of `<Column>` cells |
| `<Column>` | `width`, `align`, `verticalAlign`, `marginLeft`, `marginRight` | one cell; omit `width` on one column to take the remainder |
| `<Box>` | `style`, `width`, `align`, `marginLeft`, `marginRight`, `paddingLeft`, `paddingRight` | an indented block, optionally bordered |
| `<Line>` | `style` (`single`/`double`), `width` | a horizontal rule |
| `<Br>` | `lines` | blank line(s) |
| `<Feed>` | `dots` | precise vertical space (ESC J) — finer than `<Br>` |
| `<Cut>` | `partial` | paper cut |
| `<Cashdraw>` | `device` | cash-drawer kick pulse |
| `<Barcode>` | `value`, `symbology`, `height` | a barcode |
| `<QRCode>` | `value`, `size`, `model` | a QR code |
| `<Image>` | `image` (ImageData), `align`, `dither`, `threshold`, `width`, `height` | a raster image (logo, etc.) |

**Spacing & fine print:** `<Br lines>` adds blank lines; `<Feed dots>` adds dot-precise space (ESC J);
`<Text small>` prints in the smaller **Font B** (~9×17 vs A 12×24) for footers / "Powered by…" lines —
and `chittie-preview` renders it smaller too. For RTL rows (Arabic/Hebrew) pass `<Row rtl>`.

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
  rasterizer: myRasterizer,  // TextRasterizer
  codepage: 'cp437',         // what counts as "encodable as text"
});
```

## License

MIT.
