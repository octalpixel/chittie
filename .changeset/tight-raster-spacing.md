---
"@angadie/chittie-text": minor
"@angadie/chittie-react": minor
---

Fix double-spacing of non-Latin lines. `smartText` now returns whether it rasterized;
`<Text>` skips its trailing line-feed when the content was rasterized (a raster image
already advances the paper, so feeding again double-spaced every Sinhala/Tamil line).
