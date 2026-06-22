# @angadie/chittie-text

Smart text for chittie: print **code-page text** when the characters are representable, **auto-rasterize** complex scripts (Sinhala, Tamil, Thai, Devanagari, Arabic, …) via an **injected rasterizer**, and **never silently print `?`**.

Platform-neutral and dependency-light — it never imports canvas or skia. You supply the rasterizer; this package decides *when* to use it.

> Why: thermal printers have no font ROM or code page for Indic/complex scripts, and those scripts need shaping/reordering. The only correct path is to render the text to a bitmap on the host and send it as an image. chittie-text automates the decision and guards against the silent-`?` failure.

## Install

```bash
pnpm add @angadie/chittie-text
```

## API

### `needsRaster(text, codepage = 'cp437'): boolean`
True if any character can't be encoded in `codepage` (it would print as `?`).

```ts
import { needsRaster } from '@angadie/chittie-text';
needsRaster('Rs. 250');   // false
needsRaster('ආයුබෝවන්');  // true
```

### `TextRasterizer`
The interface **you** implement with a platform rasterizer:

```ts
interface TextRasterizer {
  rasterize(text: string, options: RasterOptions): ImageData;
}
```

A web implementation, for example, draws to a `<canvas>` and returns `ctx.getImageData(...)`. On React Native, use `react-native-skia` or a pre-rendered PNG decoded to `ImageData`.

### `smartText(encoder, text, options): void`
Prints `text` the right way onto a chittie-core encoder:

```ts
import { smartText } from '@angadie/chittie-text';

smartText(encoder, 'මිල: Rs.250', {
  rasterizer,            // optional TextRasterizer
  codepage: 'cp437',     // optional
  raster: { fontSize: 24, maxWidth: 576 }, // passed to your rasterizer
});
```

- encodable → `encoder.text(text)`
- not encodable + rasterizer → `encoder.image(...)`
- not encodable + **no** rasterizer → **throws** (no silent `?`)

## With chittie-react

`render(tree, { rasterizer, codepage })` wires this into every `<Text>` automatically — see [`@angadie/chittie-react`](../chittie-react).

## License

MIT.
