import { isValidElement, type ReactElement, type ReactNode } from 'react';
import ReceiptPrinterEncoder from '@angadie/chittie-core';
import type { Codepage, TextRasterizer } from '@angadie/chittie-text';
import { Printer } from './components.js';
import { isPrintable } from './printable.js';
import type { RenderContext } from './printable.js';
import { walk } from './walk.js';

/**
 * Resolve a custom function-component root down to the <Printer> element it
 * returns, so a whole receipt can be authored as one component:
 * `render(<MyReceipt items={…} />)`. Stops at <Printer> or any printable.
 */
function resolveRoot(element: ReactElement): ReactElement {
  let current: ReactNode = element;
  for (let i = 0; i < 100; i++) {
    if (!isValidElement(current)) break;
    const type = current.type as unknown;
    if (type === Printer || isPrintable(type) || typeof type !== 'function') break;
    current = (type as (props: unknown) => ReactNode)(current.props);
  }
  return isValidElement(current) ? current : element;
}

export interface RenderOptions {
  /** Characters per line; overridden by <Printer width>. */
  columns?: number;
  /** Printable width in dots; defaults to columns × 12 (203 DPI, font A). */
  dotWidth?: number;
  /** Printer resolution (203/300) — keeps rasterized text the same physical size across printers. */
  dpi?: number;
  /** Font fallback chain for rasterized non-Latin text. */
  fontFamilies?: string[];
  /** Supply to print non-encodable scripts (Sinhala/Tamil/…) as images. */
  rasterizer?: TextRasterizer;
  /** Code page used to decide what's encodable as text (default cp437). */
  codepage?: Codepage;
}

/** Common thermal printer profiles: characters/line + printable dot width + resolution. */
export const PRINTER_PROFILES = {
  '58mm': { columns: 32, dotWidth: 384, dpi: 203 },
  '80mm': { columns: 48, dotWidth: 576, dpi: 203 },
  '58mm-300': { columns: 48, dotWidth: 576, dpi: 300 },
  '80mm-300': { columns: 72, dotWidth: 864, dpi: 300 },
} as const;

/**
 * Render a <Printer> element tree to ESC/POS bytes by driving the vendored
 * builder. Pure: no react-dom, no DOM host elements.
 */
export function render(element: ReactElement, options: RenderOptions = {}): Uint8Array {
  const root = resolveRoot(element);
  const props = (root.props ?? {}) as { width?: number; children?: ReactNode };
  const columns = props.width ?? options.columns ?? 48;
  const dotWidth = options.dotWidth ?? columns * 12;
  const dpi = options.dpi ?? 203;
  const encoder = new ReceiptPrinterEncoder({ columns });
  encoder.initialize();
  walk(props.children, encoder, {
    columns,
    dotWidth,
    dpi,
    fontFamilies: options.fontFamilies,
    rasterizer: options.rasterizer,
    codepage: options.codepage,
  });
  return encoder.encode();
}
