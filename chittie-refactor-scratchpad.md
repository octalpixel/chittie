# chittie refactor pass — scratchpad (Kanban)

Decisions: keep vendored JS (already fully typed via .d.ts; we're a detached snapshot, not subtree). Strong static types, NO zod. chittie-text = new package, injected rasterizer.

## Doing
- READMEs: all 8 packages + root

## Backlog
- READMEs: all 8 packages + root usage
- examples: web (Web Serial + canvas rasterizer) + RN/Expo (createBleTransport + rasterizer)
- gate: pnpm check green; commit per unit; push

## Done
(v0.1 shipped previously; type fixes b186160)
- VENDOR.md corrected (manual snapshot, not subtree)
- chittie-text package (detect/smartText/no-silent-?) + spike ✓
- chittie-react integration: render({rasterizer,codepage}) → <Text> auto-routes ✓

## Invariants
- chittie-text platform-neutral (no canvas/skia dep; rasterizer injected); RN-safe
- no zod, no @ts-ignore/workarounds; pnpm check green per commit
