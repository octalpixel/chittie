import { Children, isValidElement, type ReactNode } from 'react';
import { smartText } from '@angadie/chittie-text';
import { isPrintable, type Encoder, type RenderContext } from './printable.js';

/**
 * Emit a React subtree onto an encoder. Shared by render() and by the layout
 * elements, which walk their children onto an embedded (cell-width) encoder.
 *
 * A bare string or number prints as its own line, so `<Column>2x</Column>` and
 * `<Box>Thank you</Box>` behave the way they read. Wrap it in <Text> to style it.
 */
export function walk(node: ReactNode, encoder: Encoder, ctx: RenderContext): void {
  for (const child of Children.toArray(node)) {
    if (typeof child === 'string' || typeof child === 'number') {
      const rastered = smartText(encoder, String(child), {
        rasterizer: ctx.rasterizer,
        codepage: ctx.codepage,
        raster: { maxWidth: ctx.dotWidth, dpi: ctx.dpi, fontFamilies: ctx.fontFamilies },
      });
      if (!rastered) encoder.newline();
      continue;
    }
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
