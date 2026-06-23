import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { label } from '@angadie/chittie-label';
import type { LabelProfile, TextRasterizer } from '@angadie/chittie-label';
import { Label } from './components.js';
import { isPrintable, type Builder } from './printable.js';

/** Resolve a custom function-component root down to the <Label> it returns. */
function resolveRoot(element: ReactElement): ReactElement {
  let current: ReactNode = element;
  for (let i = 0; i < 100; i++) {
    if (!isValidElement(current)) break;
    const type = current.type as unknown;
    if (type === Label || isPrintable(type) || typeof type !== 'function') break;
    current = (type as (props: unknown) => ReactNode)(current.props);
  }
  return isValidElement(current) ? current : element;
}

/** Render a <Label> element tree to TSPL bytes by driving the chittie-label builder. */
export function render(element: ReactElement): Uint8Array {
  const root = resolveRoot(element);
  const props = (root.props ?? {}) as {
    profile?: LabelProfile;
    rasterizer?: TextRasterizer;
    print?: { sets?: number; copies?: number };
    children?: ReactNode;
  };
  if (!props.profile) throw new Error('chittie-label-react: <Label> requires a `profile`.');
  const builder = label(props.profile, { rasterizer: props.rasterizer });
  walk(props.children, builder);
  return builder.encode(props.print ?? {});
}

function walk(node: ReactNode, builder: Builder): void {
  for (const child of Children.toArray(node)) {
    if (!isValidElement(child)) continue;
    const type = child.type as unknown;
    if (isPrintable(type)) {
      type.print(builder, (child.props ?? {}) as Record<string, unknown>);
      continue;
    }
    if (typeof type === 'function') {
      walk((type as (p: unknown) => ReactNode)(child.props), builder);
    } else {
      walk((child.props as { children?: ReactNode }).children, builder);
    }
  }
}
