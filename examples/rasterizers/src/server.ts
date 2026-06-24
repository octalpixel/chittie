// Server/edge rasterization — the Expo Go / no-native fallback. RN can't run Skia
// or WASM in Expo Go, so it asks a server (the companion, or an edge function) to
// shape the text and returns the bitmap. Pure `fetch` on the RN side → works in Expo Go.
import type { TextRasterizer, RasterOptions } from '@angadie/chittie-text';

// --- Server side (Node companion or edge fn): rasterize text → PNG ---------------
// Reuse the canvas rasterizer (Node @napi-rs/canvas) or the takumi-wasm one (edge),
// then encode to PNG. Sketch of an HTTP handler:
//
//   import { createCanvas } from '@napi-rs/canvas';
//   import { createCanvasRasterizer } from './canvas';
//   const raster = createCanvasRasterizer((w,h) => createCanvas(w,h));
//   app.post('/rasterize', (req,res) => {
//     const { text, fontSize, maxWidth, fontFamilies } = req.body;
//     const img = raster.rasterize(text, { fontSize, maxWidth, fontFamilies });
//     const c = createCanvas(img.width, img.height);
//     c.getContext('2d').putImageData(img, 0, 0);
//     res.type('png').send(c.toBuffer('image/png'));
//   });

// --- React Native side: a rasterizer backed by that endpoint (works in Expo Go) --
// chittie's API is synchronous (rasterize returns ImageData), so prefetch the bitmaps
// for the non-Latin runs you'll print, cache them, and serve synchronously. This
// helper does the async fetch+decode; wrap it with your cache.
export async function rasterizeViaServer(
  url: string,
  text: string,
  opts: RasterOptions,
  decodePng: (png: Uint8Array) => ImageData,
): Promise<ImageData> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, fontSize: opts.fontSize, maxWidth: opts.maxWidth, fontFamilies: opts.fontFamilies }),
  });
  if (!res.ok) throw new Error(`rasterize: HTTP ${res.status}`);
  return decodePng(new Uint8Array(await res.arrayBuffer()));
}

/** A synchronous TextRasterizer over a prefilled cache of server-rendered runs. */
export function createCachedRasterizer(cache: Map<string, ImageData>): TextRasterizer {
  return {
    rasterize(text: string): ImageData {
      const img = cache.get(text);
      if (!img) throw new Error(`chittie: no cached raster for "${text}" — prefetch it via rasterizeViaServer first.`);
      return img;
    },
  };
}
