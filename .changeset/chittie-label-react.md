---
"@angadie/chittie-label-react": minor
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

New package **`@angadie/chittie-label-react`**: pure JSX authoring for TSPL labels. A
`<Label>` root with coordinate-positioned `<LText>`, `<LBarcode>`, `<LQR>`, `<LBox>`,
`<LBar>`, `<LImage>` — mirrors `@angadie/chittie-react` (no react-dom, RN-safe) and renders
onto `@angadie/chittie-label`. Non-Latin `<LText>` rasterizes via an injected rasterizer.
chittie-label also now re-exports `TextRasterizer`/`RasterOptions`.
