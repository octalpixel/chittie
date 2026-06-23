# @angadie/chittie-codepage

## 0.2.0

### Minor Changes

- 3af3f74: Fold common typographic punctuation to ASCII before code-page encoding, so
  receipts no longer throw on ubiquitous characters. `× → x`, `— – − → -`,
  `' ' → '`, `" " → "`, `… → ...`, `• → *` (the last also avoids cp437's 0x07/BEL).
  `<Text>` (via `smartText`) and `<Row>` both fold; truly non-Latin scripts
  (Sinhala/Tamil) still raster or throw as before. New export: `foldTypographic`.

## 0.1.1

### Patch Changes

- Establish the changesets release pipeline: publish via `pnpm -r publish` so
  `workspace:*` internal deps are rewritten to real versions (changeset publish
  does not strip the workspace protocol). No package-code changes.
