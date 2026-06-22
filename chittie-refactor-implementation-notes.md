# chittie refactor pass — implementation notes

Session goal: address the v0.1 deferrals + the user's asks (JS→TS for vendored code, "zod-level" types, per-package READMEs). Spike-driven, tiny green commits, `pnpm check` per step.

## Decisions (with the pushback that shaped them)

### 1. Vendored code stays JS — we did NOT migrate codepage/core to TS
The user asked to migrate the vendored `.js` to TS. Pushed back and the user agreed:
- The vendored packages already ship **full `.d.ts`**, so consumers get complete inference today. "TS across packages" is already true for everything we own + consume.
- Rewriting ~2k lines of upstream JS would be **net-new debt**: it transfers all future maintenance to us and makes any upstream re-sync painful — to fix a *cosmetic* "it's .js" concern.
- **Correction surfaced this session:** we are NOT using `git subtree` (VENDOR.md implied it). We hold a **detached snapshot** at recorded SHAs (plain copy). Fixed VENDOR.md to state the truth + document the manual re-sync, and noted how to convert to a real subtree if we ever want auto-sync.

### 2. "zod-level type inference" = strong static types, NOT runtime zod
This is a byte-generation library; runtime schema validation adds a dependency for ~no value. Confirmed with the user. Where types needed strengthening we **derived from the engine** (e.g. `chittie-text`'s `Codepage = Parameters<typeof CodepageEncoder.encode>[1]`, and `<Barcode>`'s `BarcodeSymbology`), which is the inference quality they were after — single source of truth, no duplication.

### 3. chittie-text = new package, injected rasterizer (platform-neutral)
- Detection (`needsRaster`) uses `chittie-codepage` to find characters that encode to `0x3f` — codepage-aware, exact, no Unicode-block heuristics.
- The rasterizer is an **injected interface** (`TextRasterizer { rasterize(text, opts): ImageData }`); the package never imports canvas/skia, so it stays RN-safe and dependency-light. Web/RN rasterizers live in the examples.
- A `<Text>` that needs raster but has no rasterizer **throws a clear error** — the "no silent `?`" net. This is a deliberate behavior change from v0.1 (which printed `?`), and the correct one for a POS.
- Whole-element rasterization (not inline glyph interleaving): ESC/POS images are full-width raster blocks, so a `<Text>` with any complex-script char is rendered as one image. The system/Skia font handles mixed Latin+Sinhala + shaping.

## Scope delivered
- `chittie-text` package (+ chittie-react `render({ rasterizer, codepage })` integration).
- Per-package READMEs (all 8) — verified APIs (e.g. corrected `getEncodings()` over a guessed `supportedCodepages()`).
- Examples: `examples/web` (Web Serial + canvas rasterizer, runnable via vite) and `examples/react-native` (BLE via `createBleTransport`, ble-plx + Skia wiring docs). Both are workspace packages and typecheck against the real packages.

## Deferred (unchanged from v0.1, by agreement)
`chittie-preview`, WebUSB per-device endpoint tuning, the `0.1.0` release/changeset + workflow push (needs `workflow` token scope), and real-hardware/real-browser verification (spikes prove bytes + RN-safety in Node; on-device is the user's confirm step).

## Verification
`pnpm check` = `pnpm -r typecheck && build && test` → **10/10 typecheck** (8 packages + 2 examples), all builds, all spikes. chittie-text spike proves detect/raster-route/no-`?`; chittie-react spike proves `<Text>` Sinhala → `GS v 0` image with a rasterizer and throws without one.
