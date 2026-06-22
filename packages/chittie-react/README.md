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
| `<Text>` | `align`, `bold`, `underline`, `invert`, `size` ({width,height} multipliers), `inline` | text (or image — see below) + newline |
| `<Row>` | `left`, `right` | a two-column justified row |
| `<Line>` | — | a horizontal rule |
| `<Br>` | `lines` | blank line(s) |
| `<Cut>` | `partial` | paper cut |
| `<Cashdraw>` | `device` | cash-drawer kick pulse |
| `<Barcode>` | `value`, `symbology`, `height` | a barcode |
| `<QRCode>` | `value`, `size`, `model` | a QR code |
| `<Image>` | `image` (ImageData), `align`, `dither`, `threshold`, `width`, `height` | a raster image (logo, etc.) |

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
