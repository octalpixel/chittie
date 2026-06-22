# chittie

> *chittu* (சீட்டு) — a slip / receipt. The receipt & printing engine for the **angadie** OSS POS system.

Write a receipt once — as **JSX** or with the **builder** — and print it from **web**, **React Native / Expo**, and **Node**. Library-agnostic transports, Buffer-free core, no `react-dom`, and automatic rasterization for non-Latin scripts (Sinhala/Tamil/…).

## Packages

| Package | What it is |
|---|---|
| `@angadie/chittie` | **Front door** — batteries-included. Re-exports the builder + JSX authoring. |
| `@angadie/chittie-core` | ESC/POS + StarLine/StarPRNT encoder (builder API). *Vendored from `@point-of-sale/receipt-printer-encoder`.* |
| `@angadie/chittie-codepage` | Zero-dep code-page encoder. *Vendored from `@point-of-sale/codepage-encoder`.* |
| `@angadie/chittie-react` | Pure JSX authoring → bytes. RN-safe (no HTML host elements, no `react-dom`). |
| `@angadie/chittie-text` | Smart text: code-page when possible, auto-raster for complex scripts via an injected rasterizer. |
| `@angadie/chittie-preview` | Render ESC/POS bytes to an image (injected canvas) — preview what the printer will print. |
| `@angadie/chittie-transport` | `Transport` contract (`connect`/`write`/`disconnect`) + `chunk()`/`print()` helpers. |
| `@angadie/chittie-transport-web` | Web Serial / WebUSB / Web Bluetooth. |
| `@angadie/chittie-transport-react-native` | Library-agnostic RN/Expo adapter (bring any BLE/Classic/TCP lib) + encoding helpers. |
| `@angadie/chittie-transport-node` | Network (LAN) transport — raw TCP to `:9100` for Node / Electron / print-servers. |

## Tools

Non-npm helpers (native binary + browser extension) under [`tools/`](./tools) — not part of the pnpm workspace:

| Tool | What |
|---|---|
| [`tools/print-agent`](./tools/print-agent) | Tiny Rust localhost service — raw-prints ESC/POS to a USB/queue printer the browser can't reach (or renders a PNG in virtual mode). Pair with `createBridgeTransport()`. |
| [`tools/serial-mock`](./tools/serial-mock) | Dev-only Chrome extension — mocks `navigator.serial` to test the Web Serial path without hardware. |

## Design principles
- **DX-first**: JSX *and* builder authoring, both → the same ESC/POS bytes.
- **Runs everywhere**: Buffer-free, UTF-8 default; no `react-dom`; no DOM host elements in the React layer.
- **Library-agnostic transports**: a tiny `write(bytes)` contract; you bring the Bluetooth/serial/TCP library.
- **Vendored, not forked-and-frozen**: see [`VENDOR.md`](./VENDOR.md) for the snapshot policy.

## Limitations & caveats

Each is detailed in the linked package; this is the index.

**Platform & transport**
- **Web:** Web Serial / USB / Bluetooth need a **Chromium desktop browser** (Chrome/Edge), HTTPS, and `connect()` from a user gesture. Browsers **cannot open raw TCP**, so LAN printing needs a backend proxy or the printer's HTTP API (Epson ePOS-Print / Star WebPRNT). → [`transport-web`](./packages/chittie-transport-web), [`transport-node`](./packages/chittie-transport-node)
- **iOS = BLE only** — no Classic Bluetooth SPP (without MFi). Cheap Classic-SPP printers are **Android-only**; target **BLE** printers for cross-platform. → [`transport-react-native`](./packages/chittie-transport-react-native)
- **BLE:** ~20-byte default writes — raise MTU on Android (`requestMTU`); chittie chunks at 180. You bring the BLE lib; write value differs by lib (base64 / `number[]` / hex) — use `toBase64`/`toByteArray`/`toHex`. Needs BT permissions + an Expo dev build. → [`transport-react-native`](./packages/chittie-transport-react-native)
- **Sunmi / iMin built-in printers:** Android-only, via the device service; accept a **subset** of ESC/POS through `sendRAWData`. Use the SDK's own calls for **cut** (needs a hardware cutter), **QR**, and **images** (Bitmap API). → [`transport-react-native`](./packages/chittie-transport-react-native)
- **WebUSB** claims the first OUT endpoint; some devices need a specific interface/endpoint. → [`transport-web`](./packages/chittie-transport-web)

**Authoring & rendering**
- **`<Text>` accepts only text** (strings/numbers) — nesting a component (`<Text><Row/></Text>`) **throws a clear error** (put `<Row>`/`<Image>` as siblings). → [`chittie-react`](./packages/chittie-react)
- **No hooks / no `react-dom`** — components are pure `props → elements` (a receipt is a one-shot render). → [`chittie-react`](./packages/chittie-react)
- **Non-Latin scripts (Sinhala/Tamil/…)** require an **injected rasterizer**; without one, rendering **throws** (never a silent `?`). Detection is code-page based (default cp437). A script that *encodes* in a code page but needs shaping (e.g. Arabic) is **not** auto-detected — out of scope for now. → [`chittie-text`](./packages/chittie-text)
- **Raster images** are padded to dimensions that are multiples of 8 (ESC/POS requirement) automatically. → [`chittie-react`](./packages/chittie-react) / [`chittie-text`](./packages/chittie-text)

**Preview**
- `chittie-preview` is a **software emulation of the byte stream** (what the printer receives) — not a photo of a physical print. **Barcodes/QR render as labelled placeholder boxes** (parsed + skipped, no desync). It targets chittie's own output; arbitrary foreign ESC/POS may not parse. → [`chittie-preview`](./packages/chittie-preview)

**Vendoring & project status**
- Vendored `core`/`codepage` are **detached snapshots** at recorded SHAs (not `git subtree`); re-sync is manual. → [`VENDOR.md`](./VENDOR.md)
- **Not yet published** to npm (`0.0.0`). The `0.1.0` release (changeset + GitHub workflow) needs a token with `workflow` scope.
- **Not yet verified on physical hardware / a real browser** — spikes + the preview prove the bytes in software; on-device printing is unconfirmed.

## Status
v0.2 (unreleased) — 10 packages, `pnpm check` green (typecheck + build + spike per package). Spike-driven: JSX→real ESC/POS bytes, RN-safe, library-agnostic transports, Sinhala/Tamil raster, byte→image preview, web/RN/Node + network transports. Decisions in `chittie-build-implementation-notes.md` and `chittie-refactor-implementation-notes.md`.

## License
MIT. Vendored code retains its original MIT notices — see [`VENDOR.md`](./VENDOR.md).
