# chittie v0.1 — implementation notes

Built spike-driven (real code → real ESC/POS bytes; RN-safety by nulling Buffer/TextEncoder/DOM), tiny green commits. All 7 packages build + spike-pass.

## Key decisions
1. **Vendored JS packages ship source, no build step** (`chittie-codepage`, `chittie-core`): `exports → ./src/index.js`. Chosen for editability (no `patch-package`) and to avoid JS→d.ts build yak-shaving; valid for ESM. Types via the vendored upstream `.d.ts` (`types/index.d.ts`). TS packages (react/transports/meta) build with tsdown → `dist/*.mjs` + `*.d.mts`.
2. **`structuredClone` shim** lives in `chittie-core/src/index.js` (feature-detected; JSON clone — the cloned value is a plain style object). Fixes older Hermes (RN) without editing the vendored `text-style.js`.
3. **`@canvas/image-data` pinned `^1.1.0`** — the version that added the `react-native` entry (`index.js`, a pure WeakMap/Uint8ClampedArray polyfill). Verified file-level that all four image deps use no RN-absent browser APIs (the `window`/`self` hits are UMD-wrapper fallbacks not taken under Metro CJS; `ImageData` is in comments or the browser-only `browser.js` entry). Proof: importing core with `Buffer=undefined` + no DOM still encodes.
4. **Codepage import repointed** `@point-of-sale/codepage-encoder` → `@angadie/chittie-codepage` (3 import sites + 1 JSDoc) via sed.
5. **`chittie-react` authored fresh, not vendored** from react-thermal-printer (whose react-dom/server + iconv + dual HTML/print components are the bugs we avoid). Components return `null` + a static `print()` that drives the core builder; **zero HTML host elements**; `render()` walks the tree. RN-safe by construction.
6. **Spike-driven verification** (per directive): `test` scripts run `node`/`tsx` spikes asserting real bytes + RN-safety, not vitest unit tests. Spikes live in each package's `spikes/`.
7. **Transports**: tiny `Transport` contract (`connect?/write/disconnect?`) + `chunk`/`writeBytes`/`print`. `transport-web` uses platform APIs only (no deps). `transport-react-native` is **library-agnostic** — `createTransport(adapter)` / `createBleTransport(write)` wrap ANY BLE/Classic/TCP library; no BT lib hardcoded; BLE MTU chunking built in.

## Verification (all green)
- `pnpm -r test` — 7/7 package spikes pass (codepage bytes; core real ESC/POS + RN-safe import; **react JSX→367 bytes with Buffer/TextEncoder nulled, no react-dom**; transport chunking; web-serial via mock; RN library-agnostic chunking; meta JSX+builder).
- `pnpm -r build` — all build (codepage/core noop source-ship; react/transports/meta tsdown → ESM + d.mts).
- Commits: `b443fa7` scaffold · `d8bf9df` codepage · `d6100fa` core · `585a242` react · transport · rn+meta · web.

## NOT in v0.1 (honest scope — deliberate follow-ups, not placeholders)
- **`chittie-text` smart-raster layer** for Sinhala/Tamil (auto-detect complex-script runs → shape via injected canvas/Skia → `image()`, no silent `?`). Researched + raster-only confirmed (`docs/research/non-latin-printing/`); the seamless layer is the next feature.
- **Examples** (web Web-Serial demo; RN/Expo demo wiring a BLE lib into `createBleTransport`).
- **`chittie-preview`** package (derive a view from the model).
- **WebUSB** adapter claims the first OUT endpoint — fine generically but may need per-device tuning.
- **Release**: changeset for `0.1.0` + the GitHub release workflow push (needs `workflow` token scope; `.github/workflows/release.yml` is on disk, unpushed).
- **Real-hardware / real-browser** verification (spikes prove bytes + RN-safety in Node; on-device printing is the user's confirm step).

## Post-build type fixes (TS 5.7 + type precision)
Cursor surfaced real `tsc --noEmit` errors my gate missed — root cause: `pnpm -r build` (tsdown) emits `.d.ts` **without a strict typecheck**, and I'd only run build + spikes. Added a root `check` script (`typecheck && build && test`) so this is gated.
- **transport-web (TS 5.7 generic TypedArrays):** `Uint8Array` is now `Uint8Array<ArrayBufferLike>`; passing it to my DOM-stub params typed `BufferSource` (= non-shared `ArrayBufferView<ArrayBuffer>`) errored (TS2345, `SharedArrayBuffer` ≠ `ArrayBuffer`). Fix: the stubs are mine and only receive our byte chunks, so I typed the params as `Uint8Array` (widen to what we pass — no cast, no copy). Note `Uint8Array<ArrayBuffer>` would be *wrong* (it'd reject our generic `Uint8Array`).
- **chittie-react type precision:** added `@types/react`; modeled `<Text size>` against the engine's real `size(width, height)` numeric overload (core's `TextSize` is `"small"|"normal"`, a different concept) — renamed the prop type to `TextScale = {width,height}` and call `e.size(w, h)`; typed `<Barcode symbology>` as the engine's exported `BarcodeSymbology` union (imported from chittie-core) instead of `string`.
- Runtime unaffected (all spikes still pass); these were type-only.
