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
| `<Row>` | `left`, `right`, `rtl` | a two-column justified row (`rtl`: label flush-right, value flush-left) |
| `<Line>` | — | a horizontal rule |
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
