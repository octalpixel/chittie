import type { HybridObject } from 'react-native-nitro-modules';

/**
 * An RGBA bitmap. `width`/`height` are padded to multiples of 8 on the native
 * side so chittie's ESC/POS raster packer (`padTo8`) is a no-op.
 */
export interface RasterBitmap {
  data: ArrayBuffer;
  width: number;
  height: number;
}

/**
 * Native text rasterizer — shapes a line with the platform text engine
 * (CoreText on iOS, android.graphics on Android), which handles complex-script
 * shaping (Sinhala/Tamil joining) and bidi (Arabic/Hebrew) for free.
 */
export interface ChittieRasterizer extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /** Render `text` to an RGBA bitmap (black on white), wrapped at `maxWidth` dots. */
  rasterize(text: string, fontSize: number, maxWidth: number, bold: boolean): RasterBitmap;
}
