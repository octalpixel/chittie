import type { TextRasterizer } from '@angadie/chittie';

/**
 * A Web rasterizer for chittie-text: draws text to a <canvas> and returns its
 * ImageData. Lets Sinhala/Tamil/etc. print as a bitmap (the browser's font
 * engine handles shaping). Inject it via render(tree, { rasterizer }).
 */
export function canvasRasterizer(): TextRasterizer {
  return {
    rasterize(text, { fontSize = 28, font = 'sans-serif', bold = false, maxWidth = 576 } = {}) {
      const measure = document.createElement('canvas').getContext('2d')!;
      const fontSpec = `${bold ? 'bold ' : ''}${fontSize}px ${font}`;
      measure.font = fontSpec;
      const width = Math.min(Math.ceil(measure.measureText(text).width) + 2, maxWidth);
      const height = Math.ceil(fontSize * 1.4);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#000';
      ctx.font = fontSpec;
      ctx.textBaseline = 'top';
      ctx.fillText(text, 1, 1, maxWidth);
      return ctx.getImageData(0, 0, width, height);
    },
  };
}
