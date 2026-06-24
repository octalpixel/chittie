import { Fragment, isValidElement, type ReactNode } from 'react';
import type { BarcodeSymbology, DitherAlgorithm } from '@angadie/chittie-core';
import { smartText, padTo8, needsRaster, rasterizeRow, foldTypographic, sanitizeControl, dotsPerMm } from '@angadie/chittie-text';

const clean = (s: string) => foldTypographic(sanitizeControl(s));
// Base rasterized line height ≈ 3mm; scaled by the printer DPI so non-Latin text
// is the same physical size on 58/80mm and 203/300-DPI (1 raster px = 1 dot).
const BASE_MM = 3;
const rasterPx = (dpi: number, scale = 1) => Math.round(BASE_MM * dotsPerMm(dpi) * scale);
import type { Encoder, Printable, RenderContext } from './printable.js';

export type Alignment = 'left' | 'center' | 'right';
/** Character magnification (width/height multipliers, e.g. 2 = double). */
export type TextScale = { width: number; height: number };

/**
 * Pure recursive text extraction — no react-dom, no DOM. Strings/numbers pass
 * through; fragments are transparent. A component element is a mistake (it would
 * be silently dropped — its print() never runs from here), so we throw loudly.
 */
export function toText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number' || typeof node === 'bigint') return String(node);
  if (Array.isArray(node)) return node.map(toText).join('');
  if (isValidElement(node)) {
    if (node.type === Fragment) return toText((node.props as { children?: ReactNode }).children);
    throw new Error(
      'chittie: <Text> (and <Row>) accept only string/number text, not components. ' +
        'Put <Row>, <Image>, etc. as siblings — not nested inside <Text>.'
    );
  }
  return '';
}

const printable = <P,>(fn: (e: Encoder, p: P, ctx: RenderContext) => void) => {
  const comp = (_props: P): null => null;
  (comp as unknown as Printable).print = fn as Printable['print'];
  return comp;
};

export interface PrinterProps {
  /** Printer model passed to the encoder, e.g. 'epson'. */
  type?: string;
  /** Characters per line (default 48 / 80mm). */
  width?: number;
  children?: ReactNode;
}
/** Root element — render() reads its props; it has no print() of its own. */
export const Printer = (_props: PrinterProps): null => null;

export interface TextProps {
  align?: Alignment;
  bold?: boolean;
  underline?: boolean | number;
  invert?: boolean;
  size?: TextScale;
  /** If true, don't append a newline after the text. */
  inline?: boolean;
  children?: ReactNode;
}
export const Text = printable<TextProps>((e, p, ctx) => {
  if (p.align) e.align(p.align);
  if (p.bold) e.bold(true);
  if (p.underline) e.underline(p.underline);
  if (p.invert) e.invert(true);
  if (p.size) e.size(p.size.width, p.size.height);
  // smartText prints code-page text, or rasterizes complex scripts when a
  // rasterizer is supplied — and throws (never silent "?") when it isn't.
  const rastered = smartText(e, toText(p.children), {
    rasterizer: ctx.rasterizer,
    codepage: ctx.codepage,
    raster: {
      bold: p.bold,
      fontSize: rasterPx(ctx.dpi, p.size?.height ?? 1),
      maxWidth: ctx.dotWidth,
      dpi: ctx.dpi,
      fontFamilies: ctx.fontFamilies,
    },
  });
  // A rasterized line already advanced the paper by the image height — adding a
  // newline too would double-space it. Only feed for code-page text.
  if (!p.inline && !rastered) e.newline();
  if (p.size) e.size(1, 1);
  if (p.invert) e.invert(false);
  if (p.underline) e.underline(false);
  if (p.bold) e.bold(false);
  if (p.align) e.align('left');
});

export interface RowProps {
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}
export const Row = printable<RowProps>((e, p, ctx) => {
  const left = clean(toText(p.left));
  const right = clean(toText(p.right));
  // Non-Latin in a cell can't go through code-page text — raster the whole row
  // (left flush-left, right flush-right) as one image; throw if no rasterizer.
  if (needsRaster(left, ctx.codepage) || needsRaster(right, ctx.codepage)) {
    if (!ctx.rasterizer) {
      throw new Error(
        'chittie: <Row> contains non-encodable text (e.g. Sinhala/Tamil). Pass a rasterizer to render(), or use code-page text.'
      );
    }
    const img = rasterizeRow(ctx.rasterizer, left, right, {
      dotWidth: ctx.dotWidth,
      fontSize: rasterPx(ctx.dpi),
      dpi: ctx.dpi,
      fontFamilies: ctx.fontFamilies,
    });
    e.image(img, img.width, img.height);
    return;
  }
  const rightW = Math.min(right.length, ctx.columns);
  const leftW = Math.max(0, ctx.columns - rightW);
  e.table(
    [
      { width: leftW, align: 'left' },
      { width: rightW, align: 'right' },
    ],
    [[left, right]]
  );
});

export const Line = printable<{ children?: ReactNode }>((e) => {
  e.rule();
});

export interface BrProps {
  lines?: number;
  children?: ReactNode;
}
export const Br = printable<BrProps>((e, p) => {
  e.newline(p.lines ?? 1);
});

export interface CutProps {
  partial?: boolean;
  children?: ReactNode;
}
export const Cut = printable<CutProps>((e, p) => {
  e.cut(p.partial ? 'partial' : 'full');
});

export interface CashdrawProps {
  device?: number;
  children?: ReactNode;
}
export const Cashdraw = printable<CashdrawProps>((e, p) => {
  e.pulse(p.device);
});

export interface BarcodeProps {
  value: string;
  symbology?: BarcodeSymbology | number;
  height?: number;
  children?: ReactNode;
}
export const Barcode = printable<BarcodeProps>((e, p) => {
  e.barcode(p.value, p.symbology ?? 'code128', p.height);
});

export interface QRCodeProps {
  value: string;
  size?: number;
  model?: number;
  children?: ReactNode;
}
export const QRCode = printable<QRCodeProps>((e, p) => {
  e.qrcode(p.value, p.model, p.size);
});

export interface ImageProps {
  /** Pixel data (from a <canvas>, decoded PNG, or a rasterizer). */
  image: ImageData;
  /** Output width/height in dots; default the image's own (padded to /8). */
  width?: number;
  height?: number;
  align?: Alignment;
  /** Dithering: 'threshold' (crisp line-art/logos) | 'bayer' | 'floydsteinberg' | 'atkinson' (photos). */
  dither?: DitherAlgorithm;
  threshold?: number;
  children?: ReactNode;
}
export const Image = printable<ImageProps>((e, p) => {
  const img = padTo8(p.image); // ESC/POS raster needs dims multiple of 8
  if (p.align) e.align(p.align);
  e.image(img, p.width ?? img.width, p.height ?? img.height, p.dither, p.threshold);
  if (p.align) e.align('left');
});
