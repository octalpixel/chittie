import type { ReactNode } from 'react';
import type { BarcodeSymbology } from '@angadie/chittie-core';
import { smartText } from '@angadie/chittie-text';
import type { Encoder, Printable, RenderContext } from './printable.js';

export type Alignment = 'left' | 'center' | 'right';
/** Character magnification (width/height multipliers, e.g. 2 = double). */
export type TextScale = { width: number; height: number };

/** Pure recursive text extraction — no react-dom, no DOM. */
export function toText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number' || typeof node === 'bigint') return String(node);
  if (Array.isArray(node)) return node.map(toText).join('');
  const el = node as { props?: { children?: ReactNode } };
  if (el && typeof el === 'object' && el.props) return toText(el.props.children);
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
  smartText(e, toText(p.children), {
    rasterizer: ctx.rasterizer,
    codepage: ctx.codepage,
    raster: { bold: p.bold, fontSize: p.size ? p.size.height * 24 : undefined },
  });
  if (!p.inline) e.newline();
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
  const left = toText(p.left);
  const right = toText(p.right);
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
