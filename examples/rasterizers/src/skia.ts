// react-native-skia rasterizer (React Native). RN has no <canvas> and no WASM, so
// Skia (or captureRef) is the on-device path. It shapes Sinhala/Tamil natively.
//
// ⚠️ RECIPE — device-gated. Needs a DEV BUILD (not Expo Go), `@shopify/react-native-skia`,
// an ImageData polyfill (chittie-text's padTo8/rasterizeRow construct via `img.constructor`,
// and RN has no global ImageData — use `@canvas/image-data`), and a registered Noto font.
// readPixels is native; verify on a device. The shape below is what to adapt.
import type { TextRasterizer, RasterOptions } from '@angadie/chittie-text';
// @ts-expect-error — peer dependency, only present inside an RN app
import { Skia } from '@shopify/react-native-skia';

export interface SkiaRasterizerOptions {
  /** A loaded SkTypeface (e.g. Noto Sans Sinhala) used as the base font. */
  typeface: unknown;
  /** ImageData constructor (RN has none built in) — e.g. from '@canvas/image-data'. */
  ImageDataCtor: new (data: Uint8ClampedArray, w: number, h: number) => ImageData;
}

export function createSkiaRasterizer(opts: SkiaRasterizerOptions): TextRasterizer {
  return {
    rasterize(text: string, ro: RasterOptions = {}): ImageData {
      const fontSize = ro.fontSize ?? 28;
      const maxWidth = ro.maxWidth ?? 576;

      // Build + lay out a paragraph (Skia shapes complex scripts via HarfBuzz).
      const para = Skia.ParagraphBuilder.Make({ textAlign: 0 })
        .pushStyle({ fontSize, fontFamilies: ro.fontFamilies, fontStyle: { weight: ro.bold ? 700 : 400 } })
        .addText(text)
        .build();
      para.layout(maxWidth);
      const w = Math.min(Math.ceil(para.getLongestLine()) + 4, maxWidth);
      const h = Math.ceil(para.getHeight()) + 4;

      const surface = Skia.Surface.MakeOffscreen(w, h)!;
      const canvas = surface.getCanvas();
      canvas.clear(Skia.Color('white'));
      para.paint(canvas, 2, 2);
      surface.flush();

      const pixels = surface.makeImageSnapshot().readPixels() as Uint8Array; // RGBA
      return new opts.ImageDataCtor(new Uint8ClampedArray(pixels.buffer), w, h);
    },
  };
}

// Lighter alternative (no Skia binary, OS fonts, no bundle): react-native-view-shot —
// render an offscreen <Text style={{ fontSize, fontFamily }}>{text}</Text>, captureRef
// it to a PNG, decode to ImageData (e.g. via @canvas/image-data + a PNG decoder, or
// nitro-image's loadFromRawPixelData/toRawPixelData for a zero-copy buffer). Also a dev build.
