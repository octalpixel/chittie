import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import ReceiptPrinterEncoder from '@angadie/chittie-core';
import type { Codepage, TextRasterizer } from '@angadie/chittie-text';
import { isPrintable, type Encoder, type RenderContext } from './printable.js';

export interface RenderOptions {
  /** Characters per line; overridden by <Printer width>. */
  columns?: number;
  /** Supply to print non-encodable scripts (Sinhala/Tamil/…) as images. */
  rasterizer?: TextRasterizer;
  /** Code page used to decide what's encodable as text (default cp437). */
  codepage?: Codepage;
}

/**
 * Render a <Printer> element tree to ESC/POS bytes by driving the vendored
 * builder. Pure: no react-dom, no DOM host elements.
 */
export function render(element: ReactElement, options: RenderOptions = {}): Uint8Array {
  const props = (element.props ?? {}) as { width?: number; children?: ReactNode };
  const columns = props.width ?? options.columns ?? 48;
  const encoder = new ReceiptPrinterEncoder({ columns });
  encoder.initialize();
  walk(props.children, encoder, { columns, rasterizer: options.rasterizer, codepage: options.codepage });
  return encoder.encode();
}

function walk(node: ReactNode, encoder: Encoder, ctx: RenderContext): void {
  for (const child of Children.toArray(node)) {
    if (!isValidElement(child)) continue;
    const type = child.type as unknown;
    if (isPrintable(type)) {
      type.print(encoder, (child.props ?? {}) as Record<string, unknown>, ctx);
      continue;
    }
    if (typeof type === 'function') {
      // user-defined wrapper component: invoke and recurse into its output
      const rendered = (type as (p: unknown) => ReactNode)(child.props);
      walk(rendered, encoder, ctx);
    } else {
      // fragment / unknown host: recurse into children
      walk((child.props as { children?: ReactNode }).children, encoder, ctx);
    }
  }
}
