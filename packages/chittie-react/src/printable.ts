import ReceiptPrinterEncoder from '@angadie/chittie-core';
import type { Codepage, TextRasterizer } from '@angadie/chittie-text';

/** The vendored builder instance the components drive. */
export type Encoder = InstanceType<typeof ReceiptPrinterEncoder>;

/** Render-time context threaded to every component's print(). */
export interface RenderContext {
  columns: number;
  /** When set, <Text> with non-encodable scripts (Sinhala/Tamil/…) is rasterized. */
  rasterizer?: TextRasterizer;
  /** Code page used to decide what's encodable as text (default cp437). */
  codepage?: Codepage;
}

/** A component that knows how to emit itself onto the encoder. */
export interface Printable {
  print(encoder: Encoder, props: Record<string, unknown>, ctx: RenderContext): void;
}

export function isPrintable(type: unknown): type is Printable {
  return (
    (typeof type === 'function' || typeof type === 'object') &&
    type !== null &&
    typeof (type as { print?: unknown }).print === 'function'
  );
}
