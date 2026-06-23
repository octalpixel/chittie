import type { LabelBuilder } from '@angadie/chittie-label';

/** The chittie-label builder the components drive. */
export type Builder = LabelBuilder;

/** A component that knows how to emit itself onto the label builder. */
export interface Printable {
  print(builder: Builder, props: Record<string, unknown>): void;
}

export function isPrintable(type: unknown): type is Printable {
  return (
    (typeof type === 'function' || typeof type === 'object') &&
    type !== null &&
    typeof (type as { print?: unknown }).print === 'function'
  );
}
