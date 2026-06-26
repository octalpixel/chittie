# @angadie/chittie-label-react

## 0.5.4

### Patch Changes

- Add a `default` condition to every package's `exports` (alongside `import`). ESM-only exports
  (`"import"` only) made the packages unresolvable by CJS/tsx/jest resolvers
  (`ERR_PACKAGE_PATH_NOT_EXPORTED`); `default` makes them resolvable everywhere without changing the
  ESM output.
- Updated dependencies
  - @angadie/chittie-label@0.6.3

## 0.5.3

### Patch Changes

- @angadie/chittie-label@0.6.2

## 0.5.2

### Patch Changes

- @angadie/chittie-label@0.6.1

## 0.5.1

### Patch Changes

- Updated dependencies [4fc95fb]
  - @angadie/chittie-label@0.6.0

## 0.5.0

### Minor Changes

- 3d54f57: New package **`@angadie/chittie-label-react`**: pure JSX authoring for TSPL labels. A
  `<Label>` root with coordinate-positioned `<LText>`, `<LBarcode>`, `<LQR>`, `<LBox>`,
  `<LBar>`, `<LImage>` — mirrors `@angadie/chittie-react` (no react-dom, RN-safe) and renders
  onto `@angadie/chittie-label`. Non-Latin `<LText>` rasterizes via an injected rasterizer.
  chittie-label also now re-exports `TextRasterizer`/`RasterOptions`.

### Patch Changes

- Updated dependencies [3d54f57]
  - @angadie/chittie-label@0.5.0
