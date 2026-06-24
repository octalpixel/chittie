---
"@angadie/chittie-text": minor
"@angadie/chittie-react": minor
"@angadie/chittie-label": minor
"@angadie/chittie-transport-web": minor
---

dpi-aware rasterization + font fallback (cross-platform sizing):
- `RasterOptions` gains `fontFamilies` (ordered fallback) and `dpi`; new `dotsPerMm(dpi)` export.
- `PRINTER_PROFILES` carry `dpi` (+ 300-DPI presets); `render({ dpi, fontFamilies })` threads them.
  `<Text>`/`<Row>`/`<LText>` now derive rasterized font size from `mm × dotsPerMm(dpi) × size`, so
  non-Latin text is the same physical size on 58/80mm and 203/300-DPI; `maxWidth` = printable dots.
- `createBestTransport()` (chittie-transport-web): deterministic capability pick —
  companion (any browser, USB/queue/network) → Web Serial (Chromium + serial) → clear error.
  Reports `{ kind }`; not a shotgun. The device is still explicitly pinned.
