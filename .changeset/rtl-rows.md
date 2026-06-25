---
"@angadie/chittie-text": minor
"@angadie/chittie-react": minor
---

RTL/bidi support for rows. `rasterizeRow` and `<Row>` take `rtl` — the label reads flush-right
and the value flush-left (Arabic/Hebrew reading order), mirroring both the raster and code-page
table paths. Arabic/RTL text should be rasterized (the canvas/Skia backend shapes joining forms
and bidi); see docs/i18n.md for code-page selection guidance (Thai cp874, Japanese shiftjis, …).
