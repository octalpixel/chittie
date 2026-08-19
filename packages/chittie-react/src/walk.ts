import { Children, isValidElement, type ReactNode } from 'react';
import { isPrintable, type Encoder, type RenderContext } from './printable.js';

/**
 * Emit a React subtree onto an encoder. Shared by render() and by the layout
 * elements, which walk their children onto an embedded (cell-width) encoder.
 */
export function walk(node: ReactNode, encoder: Encoder, ctx: RenderContext): void {
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
