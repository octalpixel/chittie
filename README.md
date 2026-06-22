# chittie

> *chittu* (சீட்டு) — a slip / receipt. The receipt & printing engine for the **angadie** OSS POS system.

Write a receipt once — as **JSX** or with the **builder** — and print it from **web** and **React Native / Expo**. Library-agnostic transports, Buffer-free core, no `react-dom`.

## Packages

| Package | What it is |
|---|---|
| `@angadie/chittie` | **Front door** — batteries-included. Re-exports the builder + JSX authoring. `pnpm add @angadie/chittie` and go. |
| `@angadie/chittie-core` | ESC/POS + StarLine/StarPRNT encoder (builder API). *Vendored from `@point-of-sale/receipt-printer-encoder`.* |
| `@angadie/chittie-codepage` | Zero-dep code-page encoder. *Vendored from `@point-of-sale/codepage-encoder`.* |
| `@angadie/chittie-react` | Pure JSX authoring → bytes. RN-safe (no HTML host elements, no `react-dom`). |
| `@angadie/chittie-transport` | `Transport` contract (`connect`/`write`/`disconnect`) + `chunk()` helper. |
| `@angadie/chittie-transport-web` | Web Serial / WebUSB / Web Bluetooth. |
| `@angadie/chittie-transport-react-native` | Library-agnostic RN/Expo adapter (bring any BLE/Classic/TCP lib). |

## Design principles
- **DX-first**: JSX *and* builder authoring, both → the same ESC/POS bytes.
- **Runs everywhere**: Buffer-free, UTF-8 default; no `react-dom`; no DOM host elements in the React layer.
- **Library-agnostic transports**: a tiny `write(bytes)` contract; you bring the Bluetooth/serial/TCP library.
- **Vendored, not forked-and-frozen**: see [`VENDOR.md`](./VENDOR.md) for the upstream-sync policy.

## Status
v0.1 — all 7 packages build and pass spikes (`pnpm -r test` / `pnpm -r build`). Verified spike-driven: JSX→real ESC/POS bytes, RN-safe (Buffer/TextEncoder nulled, no react-dom), library-agnostic transports. Not yet published. Next: `chittie-text` Sinhala/Tamil smart-raster, examples, `0.1.0` release. See `chittie-build-implementation-notes.md`.

## License
MIT. Vendored code retains its original MIT notices — see [`VENDOR.md`](./VENDOR.md).
