# chittie — Roadmap & Positioning

## What chittie is

**Universal thermal receipt printing for scripts that have no code page.** Author a
receipt once (JSX or builder) → ESC/POS bytes → print from web, React Native, or a
desktop (Tauri) — and print **Sinhala, Tamil, and other complex scripts** that every
other ESC/POS library renders as `?`.

The defensible niche is **non-Latin + universal**, not generic ESC/POS. Generic receipt
encoding is a commodity (`node-thermal-printer`, `react-thermal-printer`, …). chittie's
research found *near-zero* ESC/POS Sinhala/Tamil prior art — that's the headline, and the
roadmap leans into it. We do not compete on generic receipt features.

## How we build: OSS + dogfood + stories (the Margelo model)

1. **OSS** — published `@angadie/chittie*`, semver via changesets, TS types, per-package READMEs.
2. **Dogfood** — proven through real product work (ordereka-fashion-pos, shopbook-pos).
3. **Stories** — every dogfood-surfaced gap becomes a fix *and* a technical post.

The flywheel is already turning: the ordereka migration surfaced `×`-on-cp437 → we shipped
`0.2.0` (typographic folding); their `toLocaleString` money is Intl-fragile on Hermes → we
shipped `0.3.0` (`formatMoney`, no Intl). **Each fix should ship with a changeset and a post.**

## Proof: hardware-verified ✅ (the standing #1 gap, now closed)

`ordereka-fashion-pos` shipped to **v1.0.11** on `@angadie/chittie`, lifting chittie's
`tools/print-agent/src/usb.rs` into an in-process `print_escpos` Tauri command
(winspool/CUPS queue + direct USB via `nusb` + raw TCP). It **prints on a real Xprinter**,
auto-prints on sale, kicks the cash drawer, prints a dithered logo, and handles
split-payment/refund receipts. chittie is no longer theoretical.

## Shipped

- `0.1.0` core suite (codepage/core/react/text, transports, preview, print-agent).
- `0.1.x` gap closes: printer profiles (58/80mm), `<Row>` non-Latin raster, `findWritableCharacteristic`, cheap-printer chunk preset; changesets CI (publishes via `pnpm -r publish` so `workspace:*` is stripped).
- `0.2.0` typographic folding (`× → x`, `… → ...`, …) — receipts stop throwing on smart punctuation.
- `0.3.0` `formatMoney` (RN-safe, no Intl) + `sanitizeControl` (strip injected ESC/GS from user text).
- `0.4.0` **`@angadie/chittie-label`** — TSPL label/tag printing (barcodes incl. EAN-13/Code128, QR, text, box, raster + non-Latin) — the fashion price-tag gap, as a standalone package.

## Roadmap

### Now — proof & narrative
- [ ] **Web playground** — textarea/JSX → live PNG (`chittie-preview`) + "print to your USB printer" (Web Serial). The single highest-leverage story asset; demos the Sinhala differentiator in-browser.
- [ ] **First posts** — (1) "Printing Sinhala/Tamil when no code page exists"; (2) "Why we did *not* build a Nitro module"; (3) "Running your RN library under real Hermes in CI"; (4) "ArrayBuffer zero-copy for BLE writes".
- [ ] **Discoverability** — `ci.yml` (run `pnpm check` on PRs) + README badges + reactnative.directory listing.

### Next — dogfood-driven (designs below)
- [ ] **Print status feedback** (#1 reliability) — see design.
- [x] **`chittie-label`** — TSPL label/tag printing — shipped `0.4.0`. Next: JSX `<Label>` layer (`chittie-label-react`) + label preview; verify on ordereka's label hardware.
- [ ] **Logo raster caching** — ordereka solved app-side (`v1.0.6`); upstream a cache so every consumer benefits.
- [ ] **i18n breadth** — code pages already exist for Thai (`cp874`), Japanese (`shiftjis`), Arabic; add selection guidance + RTL/bidi handling for `<Row>`.
- [ ] **print-agent threat model** — drawer-pop abuse / DoS over localhost; document + token-gate the drawer pulse.

---

## Design: print status feedback (#1)

**Problem.** The transport contract is write-only; `print_escpos` returns on *write* success,
never reading the printer. A POS can't tell paper-out / cover-open / printed-ok → risks
double-charge vs. reprint.

**Approach.** ESC/POS real-time status is `DLE EOT n` (n=1 printer, 2 offline, 3 error,
4 paper-roll), and `GS r n`. These require a **read-capable** transport.

1. Extend the `Transport` contract with an *optional* `read(timeoutMs)` (USB bulk-in, serial
   read, BLE notify). Transports that can't read simply omit it — `print()` stays unchanged.
2. Add `queryStatus(transport)` to chittie-transport: write `DLE EOT 4` (+ others), parse the
   one-byte reply into `{ online, paperOut, coverOpen, error }`.
3. `print-agent`: after USB bulk-out, bulk-in the status byte; expose on `/print` response and `/health`.

**Verification needs hardware** — ordereka's Xprinter is the verifier. Do *not* mark done
without a real paper-out / cover-open observation.

## Design: chittie-label (#2, fashion price tags)

**Problem.** chittie is ESC/POS receipts only. Fashion (ordereka) prints **garment price
tags / barcode labels**, and most label printers speak **TSPL/EPL/ZPL**, not ESC/POS.

**Approach.** A separate package `@angadie/chittie-label` (own command family, own story —
"we extended into labels"), not bolted onto the receipt core:
- TSPL first (most common on cheap label printers): `SIZE`, `GAP`, `TEXT`, `BARCODE`, `QRCODE`, `PRINT`.
- Same injected-transport contract as chittie (reuse `chittie-transport`).
- A `<Label>` JSX surface mirroring chittie-react, + `chittie-preview` support for label bitmaps.
- Verify on ordereka's label hardware before claiming done.
