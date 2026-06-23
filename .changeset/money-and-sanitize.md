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

Add `formatMoney` (RN-safe money formatting — pure `toFixed` + regex grouping, no
`Intl`, so grouping survives on Hermes where `Number.toLocaleString` silently drops it)
and `sanitizeControl` (strip C0/DEL control bytes from user text so a product/customer
name can't inject or corrupt ESC/POS commands). `<Text>` and `<Row>` sanitize then fold
before encoding. Both helpers are exported from `@angadie/chittie`.
