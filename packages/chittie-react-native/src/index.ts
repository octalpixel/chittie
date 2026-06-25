import { NitroModules } from 'react-native-nitro-modules';
import type { TextRasterizer } from '@angadie/chittie-text';
import type { ChittieRasterizer } from './specs/ChittieRasterizer.nitro.js';
import { makeRasterizer } from './adapter.js';

export { makeRasterizer } from './adapter.js';
export type { ChittieRasterizer, RasterBitmap } from './specs/ChittieRasterizer.nitro.js';

let cached: TextRasterizer | undefined;

/**
 * The native chittie rasterizer (CoreText / android.graphics) as a chittie
 * `TextRasterizer` — pass it to `render()` so Sinhala/Tamil/Arabic print on a
 * device without Skia. Requires a dev client / bare RN (native module).
 *
 * ```ts
 * import { createNativeRasterizer } from '@angadie/chittie-react-native';
 * const bytes = render(<Receipt/>, { dotWidth: 384, rasterizer: createNativeRasterizer() });
 * ```
 */
export function createNativeRasterizer(): TextRasterizer {
  if (!cached) {
    const native = NitroModules.createHybridObject<ChittieRasterizer>('ChittieRasterizer');
    cached = makeRasterizer(native);
  }
  return cached;
}
