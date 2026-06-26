# @angadie/chittie-companion

## 0.7.1

### Patch Changes

- Add a `default` condition to every package's `exports` (alongside `import`). ESM-only exports
  (`"import"` only) made the packages unresolvable by CJS/tsx/jest resolvers
  (`ERR_PACKAGE_PATH_NOT_EXPORTED`); `default` makes them resolvable everywhere without changing the
  ESM output.

## 0.7.0

### Minor Changes

- 1a340dd: `Health` now carries `paper` ("58mm" | "80mm"). The companion/agent declares its paper
  width on `/health` (via `CHITTIE_PAPER` / `PRINT_AGENT_PAPER`), so a POS can build the
  receipt to the right column width instead of guessing — preventing the 58-vs-80mm wrap.
