# chittie-label — implementation notes

## What & why
Fashion/retail POS (ordereka) prints **price/garment tags**, which use **TSPL**, not
ESC/POS. chittie's receipt stack is line-flow ESC/POS; labels are **coordinate-positioned**.
So chittie-label is a separate package (own command family) — the analog of chittie-core
for labels. A JSX `<Label>` layer (analog of chittie-react) is the planned follow-up.

## Research (firsthand)
- **No JS/TS TSPL library existed** — prior art is PHP/Java/Go/C and a couple of unmaintained
  JS scripts. chittie-label fills a real gap (a story).
- **Canonical spec:** TSC TSPL/TSPL2 Programming Manual (also Zebra's TSPL guide, Gprinter).
- **Command formats** modelled on the manual + `ThinhVu/tsc-printer-js` (closest JS analog):
  `SIZE m mm,n mm` · `GAP m mm,n mm` · `DIRECTION` · `CLS` · `TEXT x,y,"font",rot,xMul,yMul,"c"` ·
  `BARCODE x,y,"type",h,human,rot,narrow,wide,"c"` · `QRCODE x,y,ecc,cell,A,rot,"c"` ·
  `BOX x,y,xEnd,yEnd,thick` · `BAR x,y,w,h` · `BITMAP x,y,wBytes,h,mode,<bytes>` · `PRINT sets,copies`.
- **Units (verified):** 203 DPI = **8 dots/mm**, 300 DPI = **12 dots/mm**.
- **BITMAP polarity (the #1 risk) — verified against `kubesail/raster-to-tspl-js`:**
  MSB-first; **dark pixel → bit 0 (printed), light → bit 1**; width = `ceil(w/8)` bytes.
  (`tsc-printer-js` has a `(w+7)/8` bug — no floor; we use `(w+7)>>3`.)

## Decisions
- **Builder, not JSX (v1).** TSPL is imperative/positional; a fluent builder fits and is
  fully verifiable headlessly. JSX is additive (`chittie-label-react`, next).
- **RN-safe / Buffer-free.** Command structure encoded via `charCodeAt` (`ascii()`); TEXT
  content encoded through `@angadie/chittie-codepage` to match the printer's `CODEPAGE`;
  BITMAP payload is raw `Uint8Array`. The whole job is one `Uint8Array`.
- **Reuse, don't duplicate.** `needsRaster` / `foldTypographic` / `sanitizeControl` /
  `TextRasterizer` come from `@angadie/chittie-text`; non-Latin text → injected rasterizer →
  `BITMAP` (throws if no rasterizer — never a silent `?`).
- **Coordinates in dots** with `b.mm(n)` + `mmToDots()` helpers; sizes (SIZE/GAP) in mm.
- **Quote/control safety:** content is sanitized (drop C0/DEL) and `"`→`'` so it can't break
  a TSPL command.
- **Transport-agnostic:** returns bytes; reuse `@angadie/chittie-transport*` (no new dep).

## To verify on hardware (ordereka)
- BITMAP renders right-side-out (polarity) and correctly positioned.
- Real barcode scans (EAN-13 check digit, Code128 SKUs); QR scans.
- GAP/SIZE calibration on the actual label stock; DENSITY/SPEED tuning.
