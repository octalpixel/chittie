# chittie — companion & printing architecture (finalized)

The finalized design for how chittie drives printers across web, desktop, and mobile, and how a
POS vendor integrates it. Companion to `ROADMAP.md`. Sections marked **[shipped]** exist on npm
today; **[building]** is designed (linked) but not yet built — stated honestly so this isn't
vaporware docs.

## 1. One core, three shells

Byte-building is solved everywhere (chittie is universal JS). The only hard problem is the
**transport** — reaching the physical printer — which is native. So the native part is a single
Rust **core**, reused by three shells:

```
            ┌─────────────────────────── byte-building (JS, universal) ───────────────────────────┐
            │  @angadie/chittie (ESC/POS receipts) · @angadie/chittie-label (TSPL tags)  [shipped] │
            └───────────────────────────────────────────┬───────────────────────────────────────-┘
                                                         │ Uint8Array
   ┌──────────────────────── print-agent core (Rust) ──────────────────────────┐  [building]
   │  write_to_printer(bytes, target) · render_png(bytes) · discover()          │
   └───────┬───────────────────────────┬───────────────────────────┬───────────┘
           │                           │                           │
   (a) headless agent          (b) Tauri companion app      (c) vendor's own app
       service/daemon              tray + UI + server            Tauri: embed core
       [building]                  = the dev studio  [building]   Electron: sidecar/HTTP
                                                                   (ordereka = Tauri embed) [shipped pattern]
                                                         ▲
                                          @angadie/chittie-companion (JS SDK)  [building]
                                          web POS → discover · print(bytes,{station}) → result
```

- **print-agent core (Rust)** — the only place that touches hardware. `Target = Default | Usb |
  Queue(name) | Tcp(host:port)`. Embeddable. (Refactor plan: `tools/print-agent` core/bin split.)
  ⚠️ Distinct from the **JS** package `@angadie/chittie-core` (the vendored ESC/POS *byte-builder*,
  top of the diagram). Byte-building is JS (runs in the browser/RN, universal); only the *delivery*
  to hardware is Rust (native OS APIs, tiny binary, embeds in Tauri).
- **(a) Headless agent** — HTTP server over the core; install as an auto-start service. For
  automation, or vendors who want no UI.
- **(b) Tauri companion app** — the **official turnkey product**: system tray + embedded server +
  a diagnostics/studio window (printer list, per-station pin, test print, virtual-mode preview,
  "last printed → where" log). **This is also the dev studio** — production control panel and
  virtual/preview in one app.
- **(c) Vendor's own app** — **Tauri** embeds the print-agent core directly (zero IPC; what ordereka did).
  **Electron** sidecars the headless binary or talks to a running companion over HTTP.
- **JS SDK** (`@angadie/chittie-companion`) — the web POS talks to whichever shell is running.

### Why Tauri (not Electron) for our companion
Tauri *is* Rust, so the core embeds with no IPC, the binary stays small, and ordereka already
proved the path (`print_escpos` Tauri command lifting `usb.rs`). Electron is supported as a
*consumer*, not as our shell.

## 2. Transport model — capability-detect the mechanism, pin the device

We do **not** shotgun ("try every transport, use whatever answers") — that repeats the OS-default
guessing that caused ordereka's flake. Two decisions with opposite right answers:

| Decision | Nature | Approach |
|---|---|---|
| Which transport **mechanism** (Web Serial vs companion) | deterministic fact (`'serial' in navigator`) | **auto-detect** |
| Which **device** (this printer/port) | ambiguous | **pin it, explicit, once** |

- **Web is progressive-enhancement, not companion-always.** Chromium desktop + serial/BLE printers
  print directly (grants persist — one-time, not per-session). Safari/iOS and Firefox have **no**
  hardware APIs (Apple + Mozilla *declined* them permanently) → the companion is the **only** path
  there, forever. Most **USB** printers present as an **OS print queue** (WebUSB usually can't claim
  them) → the **companion-via-queue is the primary USB path**, not a fallback.
- **Device is pinned config, never guessed.** Companion: a `config.json` (per-station targets, CORS
  origins, token, virtual/real). Web SDK: a persisted settings object. **No pin → stop with a clear
  prompt** (never fall through to the OS default). **Always return where it printed.**
- **Onboarding** sets the pin once: detect capability → list printers → **test print** → pin → save.
  Auto-*suggest* the single obvious printer, but confirm with a test print; never auto-commit.

## 3. Multi-station (cafe KOT/BOT)

A cafe routes one order to several printers: receipt → counter, food → kitchen (KOT), drinks → bar
(BOT). chittie makes this first-class **without owning the routing**:

- **Config = named stations → targets:** `{ receipt: "XP-365B", kitchen: "192.168.1.51:9100", bar: "192.168.1.52:9100" }`. Stations may be different connection types (USB counter, LAN kitchen/bar).
- **Print by station:** `companion.print(bytes, { station: 'kitchen' })` — the companion resolves
  station → target.
- **Routing is the POS's business logic.** You map menu items → stations (by category), split the
  order, and build one ticket per station with chittie components (a KOT is just a different
  template — big font, item+qty+modifiers+table/order#+time, no prices). chittie provides multi-target
  config + per-station templates + per-station print; it does not decide which item goes where.
- **Per-event:** fire KOT/BOT on order-placed, receipt on payment, reprints/void tickets as needed —
  all just "build bytes → print to station X".

## 4. Status — what's shipped vs building

| Area | Status |
|---|---|
| Byte-building: receipts (`@angadie/chittie`), labels (`@angadie/chittie-label` + `-react`) | **shipped** (npm 0.5.0 / preview 0.6.0) |
| Non-Latin raster, typographic fold, `formatMoney`, `sanitizeControl` | **shipped** |
| Software preview: `renderReceipt` + `renderLabel` | **shipped** |
| Playground (receipt + label tabs) | **shipped** |
| print-agent core/bin split: `chittie_agent::core` (`Target` + `write_to_printer`) + `server::run` + `POST /print-raw` + TCP | **shipped** (cargo build + tests + smoke) |
| JS SDK `@angadie/chittie-companion` (discover / print-to-station / result, no-pin hard-gate) | **shipped** (npm 0.6.0) |
| Tauri companion app (embeds core + server + tray + diagnostics UI) | **scaffolded** (`apps/companion`; bundle via CI) |
| CI: `companion-release.yml` (tauri-action matrix) + headless `print-agent-release.yml` | **shipped** (CI-built artifacts) |
| `createBestTransport` (companion > web-serial > error, deterministic) | **shipped** (chittie-transport-web 0.6.0) |
| dpi-aware raster sizing + `fontFamilies` (same physical size across 58/80mm & 203/300-DPI) | **shipped** (0.6.0) |
| Rasterizer adapters: **canvas** (web/node) verified; **skia** (RN), **takumi-wasm** (edge), **server** (Expo Go) recipes | **shipped** (`examples/rasterizers`) |
| On-device RN rasterization (Skia/captureRef `readPixels`) + real-printer verification | **device-gated** (hardware step) |
| Onboarding recipe component | **building** |
| Virtual printer port (CUPS backend / Windows RedMon) | **designed** (`tools/print-agent/VIRTUAL-PRINTER.md`) |
| Printer status feedback (paper-out via `DLE EOT`) | **designed** (ROADMAP) |

## 5. Sequencing
1. print-agent core/bin split + `Target` + `/print-raw` + `print()`-returns-result.
2. JS SDK (discover, print-to-pinned-target, result) + capability detection.
3. Tauri companion app = embedded core + diagnostics/studio UI + per-station config + onboarding.
4. Multi-station (KOT/BOT) config + templates.
5. Virtual printer port (CUPS/RedMon); status feedback.
