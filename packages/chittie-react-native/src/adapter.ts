import type { RasterOptions, TextRasterizer } from '@angadie/chittie-text';
import type { ChittieRasterizer } from './specs/ChittieRasterizer.nitro.js';

/**
 * Adapt a native `ChittieRasterizer` HybridObject to chittie's `TextRasterizer`.
 * The native side returns an RGBA bitmap (dims already padded to /8); we wrap it
 * as the structural `ImageData` chittie's raster pipeline consumes. Pure and
 * dependency-free at runtime (no Nitro import) — inject `native` so it's testable
 * off-device.
 */
export function makeRasterizer(native: ChittieRasterizer): TextRasterizer {
  return {
    rasterize(text: string, options: RasterOptions = {}): ImageData {
      const { fontSize = 24, maxWidth = 576, bold = false } = options;
      const b = native.rasterize(text, fontSize, maxWidth, !!bold);
      // RGBA, structural ImageData — chittie reads { data, width, height }.
      return {
        data: new Uint8ClampedArray(b.data),
        width: b.width,
        height: b.height,
        colorSpace: 'srgb',
      } as unknown as ImageData;
    },
  };
}
