# chittie — Roadmap & Positioning

## What chittie is

**Universal thermal printing for scripts that have no code page.** Author a receipt or label
once (JSX or builder) → ESC/POS or TSPL bytes → print from web, React Native, or a desktop
(Tauri) — and print **Sinhala, Tamil, and other complex scripts** that every other ESC/POS
library renders as `?`.

The defensible niche is **non-Latin + universal**, not generic ESC/POS. Generic receipt encoding
is a commodity. chittie's research found *near-zero* ESC/POS Sinhala/Tamil prior art — that's the
headline, and the roadmap leans into it. We do not compete on generic receipt features.

## How we build: OSS + dogfood + stories (the Margelo model)

1. **OSS** — published `@angadie/chittie*`, semver via changesets, TS types, per-package READMEs.
2. **Dogfood** — proven through real product work (ordereka-fashion-pos, shopbook-pos).
3. **Stories** — every dogfood-surfaced gap becomes a fix *and* a technical post.

The flywheel keeps turning: `×`-on-cp437 → `0.2.0` folding; Intl-fragile money → `0.3.0`
`formatMoney`; and most recently a real 58mm print exposed double-spaced non-Latin lines →
`chittie-text/react 0.7.0`. **Each fix ships with a changeset; the post is the missing half.**

## Proof: hardware-verified ✅

- **ordereka-fashion-pos** runs on chittie (its `@ordereka/receipt` package), lifting the
  print-agent USB core into an in-process `print_escpos` Tauri command — prints on a real Xprinter,
  auto-prints on sale, kicks the drawer, dithered logo, split-payment/refund receipts.
- **The Chittie Companion + playground** printed real receipts — including a **Sinhala line** — on a
  real **58mm ET PR-10** over direct USB (the `N32G43x` device), end to end (playground → companion
  SDK → printer). That run is what surfaced and fixed the non-Latin spacing bug.

Two **hardware-gated** gaps remain testable now that a printer is on the desk: **print status
feedback** and **label (TSPL) verification**.

## Shipped

- `0.1.x` core suite (codepage/core/react/text, transports, preview, print-agent); printer profiles
  (58/80mm), `<Row>` non-Latin raster; changesets CI (publishes via `pnpm -r publish`, strips `workspace:*`).
- `0.2.0` typographic folding; `0.3.0` `formatMoney` (RN-safe, no Intl) + `sanitizeControl`.
- `0.4.0` **`@angadie/chittie-label`** (TSPL labels: EAN-13/Code128/QR/text/box/raster + non-Latin).
- `0.5.0` **`@angadie/chittie-label-react`** (positioned JSX labels); `chittie-preview 0.6.0` `renderLabel`.
- **dpi-aware rasterization** + `fontFamilies` + `createBestTransport` (0.6.0); cross-platform
  `TextRasterizer` interface (canvas verified; skia/takumi/server backends).
- **`chittie-text/react 0.7.0`** — fix double-spaced non-Latin lines (`smartText` reports raster;
  `<Text>` skips the redundant feed). Found on real 58mm hardware.
- **`@angadie/chittie-companion` SDK** — discover → print-to-pinned-station → result; never a silent
  fallback. Full integration manual (`packages/chittie-companion/MANUAL.md`).
- **Chittie Companion (Tauri app, v0.1.3)** — the print bridge + diagnostics, store-owner-first UI
  (status / pin printer / auto-detect / virtual-mode / **paper 58-80mm** picker), **silent-tray
  autostart + close-to-tray** (true one-time setup), no Windows console, **auto-updater**, runtime
  branding. **CI builds Windows + macOS + Linux installers**; Windows `.exe` on R2. Unsigned (paid certs pending).
- **Spacing + fine print** — `<Feed dots>` (ESC J), `<Text small>` (Font B, also in `chittie-preview`),
  `<Row rtl>` for Arabic/Hebrew.
- **Web playground** — author → live preview → print via the companion SDK; deployed to Cloudflare
  Pages (`chittie-playground.pages.dev`) for shareable UI/preview.
- **PNA header** on the agent — hosted HTTPS POS can reach localhost on Chrome/Edge.

## Roadmap (pending)

### Reliability (highest value)
- [~] **Print status feedback** (#1) — transport `queryStatus()` (`DLE EOT`) **shipped**
  (chittie-transport 0.6.0); the agent's USB bulk-in read is **hardware-gated** (nusb's reader is
  blocking → needs the async/timeout path + a device). Design below.
- [x] **Paper size on `/health`** — agent declares 58/80mm (`CHITTIE_PAPER`) on `/health`; SDK
  `Health.paper` (chittie-companion 0.7.0).

### Hosted web POS — trusted localhost
- [x] **PNA header** → Chrome/Edge/Firefox hosted POS reach localhost.
- [ ] **localhost TLS (Path B)** — public loopback cert (`printer.<domain>` → `127.0.0.1`) served via
  `rustls`, so **Safari/iPad** and all browsers work. Decision record: `docs/localhost-tls.md`.

### Distribution
- [x] **Linux companion build** — fixed (`libcups2-dev`); `.deb`/`.rpm`/`.AppImage` now build in CI.
- [x] **Auto-updater** — `tauri-plugin-updater` + signed artifacts + tray "Check for updates"
  (wired; CI signs via `TAURI_SIGNING_PRIVATE_KEY`; verifies once a release is published).
- [ ] **Code signing / notarization** (optional; removes SmartScreen/Gatekeeper warnings for
  non-technical owners — distribution works unsigned until then).

### Labels
- [ ] **Verify TSPL on real label hardware** (ordereka's label printer) before claiming done.

### Breadth / hardening
- [x] **i18n breadth + RTL** — `rtl` on `<Row>`/`rasterizeRow` + `docs/i18n.md` selection guidance
  (chittie-text/react 0.8.0).
- [x] **Raster caching** — `cacheRasterizer` (LRU memo of raster output) upstreamed (chittie-text 0.8.0).
- [~] **RN native package** — `@angadie/chittie-react-native` **scaffolded + TS-verified** (Nitro
  rasterizer, RFC Phase 1: spec + Swift/Kotlin impls + adapter spike + monorepo gate). **Device-gated:**
  `nitro-codegen` + iOS/Android compile + on-device glyph snapshot (npm publish held until then).
  RFC: `docs/rfc/rn-native.md`. Next: Phase 2 BLE transport + status.
- [ ] **print-agent threat model** — drawer-pop DoS over localhost; token-gate the pulse.
- [x] **Studio mode** — CUPS backend + installers shipped (`tools/print-agent/studio/`); the
  `lpadmin`/RedMon install + end-to-end print is OS/sudo-gated.

### Narrative (the missing half of the flywheel)
- [ ] **First posts** — (1) "Printing Sinhala/Tamil when no code page exists"; (2) "Why we did *not*
  build a Nitro module"; (3) "Running an RN library under real Hermes in CI"; (4) "Finding a print bug
  only real hardware shows" (the 58mm double-feed).
- [x] **Discoverability** — `ci.yml` (`pnpm check` on PRs) ✓ + README badges ✓. Remaining: reactnative.directory listing.

---

## Design: print status feedback (#1)

**Problem.** The transport contract is write-only; `print_escpos` returns on *write* success, never
reading the printer. A POS can't tell paper-out / cover-open / printed-ok → double-charge vs reprint risk.

**Approach.** ESC/POS real-time status is `DLE EOT n` (1 printer, 2 offline, 3 error, 4 paper) and
`GS r n`, which need a **read-capable** transport.
1. Extend `Transport` with an *optional* `read(timeoutMs)` (USB bulk-in, serial read, BLE notify);
   transports that can't read omit it — `print()` is unchanged.
2. `queryStatus(transport)` in chittie-transport: write `DLE EOT 4` (+ others), parse the byte into
   `{ online, paperOut, coverOpen, error }`.
3. print-agent: bulk-in the status byte after bulk-out; expose on `/print` + `/health`.

**Verification needs hardware** — the 58mm ET PR-10 / ordereka's Xprinter. Do *not* mark done without
a real paper-out / cover-open observation.

## Design: localhost TLS for hosted web POS

See `docs/localhost-tls.md` — corrected browser facts (localhost is a secure origin; PNA is the
Chrome/Edge gate, not mixed content; Safari needs real hostname + TLS), the two paths (local CA vs
public loopback cert), and the decision (**Path B** for the retail product, `rcgen`/`rustls`
in-process, TLS behind a flag, HTTP default for now).

## Design: companion architecture

See `docs/architecture.md` (one Rust core, three shells) and `docs/companion-product.md` (one app /
progressive disclosure / autostart / distribution). The companion app, SDK, and multi-station (KOT/BOT)
are shipped; remaining companion work is listed under Distribution + Hosted web POS above.

## Design: chittie-label (shipped)

A separate package `@angadie/chittie-label` (own command family, own story), not bolted onto the
receipt core: TSPL first (`SIZE`/`GAP`/`TEXT`/`BARCODE`/`QRCODE`/`PRINT`), same injected-transport
contract, a `<Label>` JSX surface, `chittie-preview` `renderLabel`. **Remaining: verify on real label
hardware** (see Labels above).
