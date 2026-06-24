// Takumi-wasm rasterizer (browser / edge / serverless / Node). The canvas-free,
// deterministic option: bundled fonts + parley shaping → identical output everywhere
// there's no DOM canvas (Cloudflare Workers, Vercel Edge, Deno). NOT React Native
// (Hermes has no WASM).
//
// ⚠️ RECIPE — edge-gated. `npm i @takumi-rs/wasm` (currently v2 beta — keep it an
// optional adapter, not a chittie core dep) + a Noto font (.ttf bytes). Decodes the
// rendered PNG to ImageData (provide a PNG decoder for your runtime).
import type { TextRasterizer, RasterOptions } from '@angadie/chittie-text';
// @ts-expect-error — optional dependency
import { Renderer } from '@takumi-rs/wasm';

export interface TakumiRasterizerOptions {
  /** Noto font bytes registered for shaping (Sinhala/Tamil/…). */
  fonts: Uint8Array[];
  /** Decode PNG bytes → ImageData for your runtime (browser: createImageBitmap+canvas; node: @napi-rs/canvas). */
  decodePng: (png: Uint8Array) => ImageData;
}

export function createTakumiRasterizer(opts: TakumiRasterizerOptions): TextRasterizer {
  const renderer = new Renderer();
  return {
    rasterize(text: string, ro: RasterOptions = {}): ImageData {
      const fontSize = ro.fontSize ?? 28;
      const node = {
        type: 'div',
        props: {
          style: {
            color: 'black',
            background: 'white',
            fontSize,
            fontFamily: (ro.fontFamilies ?? []).join(', ') || 'sans-serif',
            fontWeight: ro.bold ? 700 : 400,
            padding: 2,
          },
          children: text,
        },
      };
      // Synchronous WASM render → PNG bytes, then decode to ImageData.
      const png = renderer.render(node, { width: ro.maxWidth ?? 576, fonts: opts.fonts, format: 'png' }) as Uint8Array;
      return opts.decodePng(png);
    },
  };
}
