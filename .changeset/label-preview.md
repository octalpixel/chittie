---
"@angadie/chittie-preview": minor
---

Add `renderLabel(bytes, options)` — render the TSPL bytes from `@angadie/chittie-label`
(or `chittie-label-react`) to a canvas: `SIZE`-driven dimensions, positioned `TEXT`,
`BOX`, `BAR`, `BITMAP` (correct bit polarity), and representative `BARCODE`/`QRCODE`
previews. Same injected-canvas pattern as `renderReceipt` (browser or @napi-rs/canvas).
