---
"@angadie/chittie-label": minor
"@angadie/chittie": minor
"@angadie/chittie-core": minor
"@angadie/chittie-codepage": minor
"@angadie/chittie-react": minor
"@angadie/chittie-text": minor
"@angadie/chittie-preview": minor
"@angadie/chittie-transport": minor
"@angadie/chittie-transport-web": minor
"@angadie/chittie-transport-node": minor
"@angadie/chittie-transport-react-native": minor
---

New package **`@angadie/chittie-label`**: TSPL label/tag printing for chittie. A
coordinate-based builder for fashion/retail labels — positioned `text`, `barcode`
(EAN-13/Code128/Code39/UPC/…), `qrcode`, `box`, `bar`, and `image` (1-bit BITMAP).
Non-Latin text rasterizes via an injected rasterizer (reusing chittie-text); never a
silent `?`. RN-safe / Buffer-free; returns `Uint8Array` for any chittie transport.
