---
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

Fold common typographic punctuation to ASCII before code-page encoding, so
receipts no longer throw on ubiquitous characters. `× → x`, `— – − → -`,
`' ' → '`, `" " → "`, `… → ...`, `• → *` (the last also avoids cp437's 0x07/BEL).
`<Text>` (via `smartText`) and `<Row>` both fold; truly non-Latin scripts
(Sinhala/Tamil) still raster or throw as before. New export: `foldTypographic`.
