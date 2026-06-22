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

## chittie-preview (promoted from proto) + node-thermal-printer comparison

### node-thermal-printer (firsthand, Klemen1337/node-thermal-printer @ 918★)
Node-only: deps `fs`/`net`/`Buffer`/`pngjs`/`iconv-lite`/`unorm`. Transports = File (device/share via fs), Network (TCP `net.connect` to IP:9100), OS-Printer. Builder API, no JSX. `printImage(path)` via fs+pngjs (you supply a PNG). No Web Serial/USB/BLE, no React Native, no automatic complex-script handling, no preview. **Verdict: overlaps on "emit ESC/POS" but targets server/desktop; chittie targets browser+RN client + DX (JSX) + auto Sinhala/Tamil raster + preview. Does NOT change the plan** — it's the better pick for pure Node backend printing; chittie owns the client/non-Latin niche.

### @angadie/chittie-preview
Promoted the `examples/preview` proto into a real package. Parses chittie's ESC/POS into draw ops on an **injected canvas** (browser `HTMLCanvasElement` or `@napi-rs/canvas`) — no canvas dependency, same injection pattern as chittie-text. Handles **both image modes**: column `ESC *` (chittie's DEFAULT) and raster `GS v 0`. Barcode (`GS k`) and QR (`GS ( k`) bytes are parsed for length and skipped (labelled placeholder box) so the stream never desyncs — proven by a spike that puts `TOTAL` *after* a barcode and asserts it still renders. The example now dogfoods the package (default column mode); `pnpm check` = 11/11 typecheck, 11 spikes.

### Remaining deferrals (after this pass)
- **WebUSB per-device endpoint tuning** — `createWebUsbTransport` claims the first OUT endpoint; some devices need a specific interface/endpoint.
- **0.1.0 release** — create a changeset + push `.github/workflows/release.yml` (changesets) + `npm publish`. NOTE: the `workflow`-scope blocker is RESOLVED — `print-agent-release.yml` pushed fine, so the token now has scope. Just not done yet.
- **Print-agent binaries** — only macOS arm64 is committed; tag `print-agent-v*` to run the cross-build CI for Windows/Linux/Intel. Signed installers need code-signing certs (Windows ~$120/yr, macOS $99/yr — paid).
- **Real-hardware / real-browser verification** — spikes + the preview prove the bytes in software; printing on a physical XP-365B and live Web Serial/BLE in a browser is the user's confirm step.
- (minor) chittie-text Arabic-shaping nuance (chars that *encode* in a codepage but render unshaped) is out of scope; Sinhala/Tamil (no codepage) are fully handled.
