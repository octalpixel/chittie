# @angadie/chittie-preview

Render a receipt to an **image** by parsing the ESC/POS bytes chittie emits — a
software preview of *what the printer will actually print*. Platform-neutral: you
inject a canvas factory, so it works in the browser (`HTMLCanvasElement`) and in
Node (`@napi-rs/canvas`) with **no hard dependency** — the same pattern as
[`@angadie/chittie-text`](../chittie-text)'s injected rasterizer.

Handles chittie's real output: text + bold + double-size, rules, paper cut, and
**both image modes** (column `ESC *` — the default — and raster `GS v 0`). Barcodes
and QR codes are drawn as labelled placeholder boxes (their bytes are parsed and
skipped cleanly, so nothing desyncs).

## Install

```bash
pnpm add @angadie/chittie-preview
```

## Browser

```ts
import { renderReceipt } from '@angadie/chittie-preview';

const canvas = renderReceipt(bytes, {
  createCanvas: (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }),
});
document.body.appendChild(canvas); // or canvas.toDataURL()
```

## Node

```ts
import { renderReceipt } from '@angadie/chittie-preview';
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

const canvas = renderReceipt(bytes, { createCanvas });
writeFileSync('receipt.png', canvas.toBuffer('image/png'));
```

`bytes` is the `Uint8Array` from chittie's `render()` or `encode()`.

## Options

| Option | Default | Meaning |
|---|---|---|
| `createCanvas(w, h)` | — | **required** canvas factory |
| `columns` | `32` | characters per line (match your `<Printer width>`) |
| `cellWidth` | `12` | px per character cell |
| `lineHeight` | `26` | px per text line |
| `fontFamily` | `'monospace'` | text font |
| `padding` | `16` | outer padding px |

## Prior art

[`node-thermal-printer`](https://github.com/Klemen1337/node-thermal-printer) prints
to thermal printers from Node (file/network/OS-printer), but it's Node-only
(`fs`/`net`/`pngjs`) and has no preview. chittie-preview is platform-neutral (browser
+ node via the injected canvas) and renders the byte stream itself.

## License

MIT.
