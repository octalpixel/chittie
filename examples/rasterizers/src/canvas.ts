// Canvas rasterizer — the default adapter. Works in the browser (HTMLCanvasElement)
// and in Node (@napi-rs/canvas) via an injected `createCanvas`. The platform's text
// engine shapes Sinhala/Tamil/etc.; register a Noto font for deterministic output.
import type { TextRasterizer, RasterOptions } from '@angadie/chittie-text';

export interface Canvas2D {
  font: string;
  fillStyle: string;
  textBaseline: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  getImageData(x: number, y: number, w: number, h: number): ImageData;
}
export interface CanvasLike {
  width: number;
  height: number;
  getContext(type: '2d'): Canvas2D | null;
}
export type CreateCanvas = (width: number, height: number) => CanvasLike;

/**
 * Build a chittie rasterizer over any canvas. `createCanvas`:
 *   browser → `(w,h) => Object.assign(document.createElement('canvas'),{width:w,height:h})`
 *   node    → `@napi-rs/canvas` `createCanvas`
 * Honors `fontSize` (dots), `bold`, `fontFamilies` (fallback chain), and `maxWidth`
 * (shrinks the font to fit the printable dot width).
 */
export function createCanvasRasterizer(
  createCanvas: CreateCanvas,
  defaults: { fontFamily?: string; padding?: number } = {}
): TextRasterizer {
  const pad = defaults.padding ?? 2;
  const fallback = defaults.fontFamily ?? 'sans-serif';
  return {
    rasterize(text: string, opts: RasterOptions = {}): ImageData {
      let fontSize = opts.fontSize ?? 28;
      const families = (opts.fontFamilies?.length ? opts.fontFamilies : [fallback]).map((f) => `"${f}"`).join(', ');
      const fontStr = (fs: number) => `${opts.bold ? 'bold ' : ''}${fs}px ${families}`;

      const ctx0 = createCanvas(8, 8).getContext('2d');
      if (!ctx0) throw new Error('canvas: no 2d context');
      ctx0.font = fontStr(fontSize);
      let w = Math.ceil(ctx0.measureText(text).width) + pad * 2;

      // fit-to-width: shrink the font so the run fits the printable dots
      if (opts.maxWidth && w > opts.maxWidth) {
        fontSize = Math.max(8, Math.floor(fontSize * (opts.maxWidth / w)));
        ctx0.font = fontStr(fontSize);
        w = Math.min(Math.ceil(ctx0.measureText(text).width) + pad * 2, opts.maxWidth);
      }
      const h = Math.ceil(fontSize * 1.5);

      const canvas = createCanvas(w, h);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas: no 2d context');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#000';
      ctx.font = fontStr(fontSize);
      ctx.textBaseline = 'top';
      ctx.fillText(text, pad, pad);
      return ctx.getImageData(0, 0, w, h);
    },
  };
}
