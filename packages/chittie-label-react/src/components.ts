import { Fragment, isValidElement, type ReactNode } from 'react';
import type { LabelProfile, BarcodeType, TextRasterizer } from '@angadie/chittie-label';
import type { Builder, Printable } from './printable.js';

/** Pure recursive text extraction — no react-dom. Strings/numbers pass through;
 * fragments are transparent; a component child is a mistake, so throw loudly. */
export function toText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number' || typeof node === 'bigint') return String(node);
  if (Array.isArray(node)) return node.map(toText).join('');
  if (isValidElement(node)) {
    if (node.type === Fragment) return toText((node.props as { children?: ReactNode }).children);
    throw new Error('chittie-label: <LText> accepts only string/number text, not components.');
  }
  return '';
}

const printable = <P,>(fn: (b: Builder, p: P) => void) => {
  const comp = (_props: P): null => null;
  (comp as unknown as Printable).print = fn as Printable['print'];
  return comp;
};

export type Rotation = 0 | 90 | 180 | 270;

export interface LabelProps {
  /** Label stock + printer setup (size in mm, dpi, gap, density…). */
  profile: LabelProfile;
  /** Supply to print non-Latin text (Sinhala/Tamil/…) as a rasterized image. */
  rasterizer?: TextRasterizer;
  /** PRINT count: `sets` labels, `copies` each. */
  print?: { sets?: number; copies?: number };
  children?: ReactNode;
}
/** Root element — render() reads its props; it has no print() of its own. */
export const Label = (_props: LabelProps): null => null;

export interface LTextProps {
  x: number;
  y: number;
  font?: string;
  rotation?: Rotation;
  xMul?: number;
  yMul?: number;
  rasterFontSize?: number;
  children?: ReactNode;
}
export const LText = printable<LTextProps>((b, p) => {
  b.text(p.x, p.y, toText(p.children), {
    font: p.font,
    rotation: p.rotation,
    xMul: p.xMul,
    yMul: p.yMul,
    rasterFontSize: p.rasterFontSize,
  });
});

export interface LBarcodeProps {
  x: number;
  y: number;
  data: string | number;
  type?: BarcodeType;
  height?: number;
  human?: 0 | 1 | 2;
  rotation?: Rotation;
  narrow?: number;
  wide?: number;
  children?: ReactNode;
}
export const LBarcode = printable<LBarcodeProps>((b, p) => {
  b.barcode(p.x, p.y, p.data, {
    type: p.type,
    height: p.height,
    human: p.human,
    rotation: p.rotation,
    narrow: p.narrow,
    wide: p.wide,
  });
});

export interface LQRProps {
  x: number;
  y: number;
  data: string;
  ecc?: 'L' | 'M' | 'Q' | 'H';
  cell?: number;
  rotation?: Rotation;
  children?: ReactNode;
}
export const LQR = printable<LQRProps>((b, p) => {
  b.qrcode(p.x, p.y, p.data, { ecc: p.ecc, cell: p.cell, rotation: p.rotation });
});

export interface LBoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  thickness?: number;
  children?: ReactNode;
}
export const LBox = printable<LBoxProps>((b, p) => {
  b.box(p.x, p.y, p.w, p.h, p.thickness);
});

export interface LBarProps {
  x: number;
  y: number;
  w: number;
  h: number;
  children?: ReactNode;
}
export const LBar = printable<LBarProps>((b, p) => {
  b.bar(p.x, p.y, p.w, p.h);
});

export interface LImageProps {
  x: number;
  y: number;
  image: ImageData;
  mode?: 0 | 1 | 2;
  threshold?: number;
  children?: ReactNode;
}
export const LImage = printable<LImageProps>((b, p) => {
  b.image(p.x, p.y, p.image, { mode: p.mode, threshold: p.threshold });
});
