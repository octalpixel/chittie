# chittie rasterizers — one interface, a backend per platform

chittie's `TextRasterizer` is injected: `(text, RasterOptions) => ImageData`. Non-Latin runs
(Sinhala/Tamil/…) and logos are shaped by the platform's text engine and embedded as a raster.
There's no single engine that runs everywhere (React Native has no `<canvas>` and no WASM), so we
ship **one interface with a backend per platform**:

| Platform | Adapter | Status |
|---|---|---|
| Browser (Chromium/Safari) · Tauri webview | **canvas** (`src/canvas.ts`) | ✅ verified |
| Node (server) | **canvas** via `@napi-rs/canvas` | ✅ verified (spike) |
| Edge / serverless (Cloudflare/Vercel/Deno) | **takumi-wasm** (`src/takumi.ts`) | recipe — `npm i @takumi-rs/wasm` (v2 beta) |
| React Native (dev build) | **skia** (`src/skia.ts`) or captureRef | recipe — device-gated |
| React Native **Expo Go** / no-native | **server/edge** (`src/server.ts`) | recipe — pure `fetch` |

## Sizing across papers (dpi-aware)
**1 raster pixel = 1 printer dot**, and `dots = mm × dpi/25.4` (203 DPI → 8 dots/mm, 300 → ~12).
chittie derives the rasterized font size from the profile's `dpi` (`<Text size>` × `dotsPerMm(dpi)`),
so text is the **same physical size** on 58/80mm and 203/300-DPI. Each adapter just honors:
- `fontSize` (dots), `bold`, `fontFamilies` (fallback chain), `maxWidth` (printable dots — fit/clip).

## Use it
```ts
// Browser / Tauri:
import { createCanvasRasterizer } from './canvas';
const rasterizer = createCanvasRasterizer((w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }));
render(<Receipt/>, { rasterizer, dotWidth: 576, dpi: 203, fontFamilies: ['Noto Sans Sinhala', 'Noto Sans Tamil'] });

// Node:
import { createCanvas } from '@napi-rs/canvas';
const rasterizer = createCanvasRasterizer((w, h) => createCanvas(w, h));
```
For deterministic Sinhala/Tamil, register the Noto fonts (browser: `@font-face` + `document.fonts.ready`;
`@napi-rs/canvas`: `GlobalFonts.registerFromPath(...)`) and pass them in `fontFamilies`.

## RN reality
- **Dev build** (not Expo Go): **Skia** (`Paragraph`→`readPixels`, best/deterministic, bundled fonts)
  or **captureRef** (lighter, OS fonts). Both native → need a dev build; verify on a device.
  `nitro-image` can do the zero-copy pixel handoff / native compositing (it shapes nothing).
- **Expo Go / no-native:** the **server/edge** adapter — fetch the bitmap from the companion or a
  takumi-wasm edge function, cache it, serve it synchronously to chittie's `rasterize`.

`canvas` is verified here; `skia`/`takumi`/`server` are correct-shaped recipes to adapt + verify on
their target (device / edge), since they can't run in a headless Node test.
