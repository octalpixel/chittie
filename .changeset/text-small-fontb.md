---
"@angadie/chittie-react": minor
"@angadie/chittie-preview": minor
---

`<Text small>` selects the printer's smaller built-in font (ESC/POS **Font B**, ~9×17 vs Font A
12×24) — for receipt footers / "Powered by …" fine print. Composes with `align`/`bold`; non-Latin
`small` text shrinks its raster to match. chittie-preview now honors Font B (`ESC M`), so the
on-screen preview matches the print.
