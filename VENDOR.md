# Vendoring & upstream-sync policy

chittie **vendors** a few MIT libraries (copies their source into this repo) rather than
depending on them, so we can edit freely without `patch-package`. Vendored ≠ frozen — we keep a
sync path so we can still pull upstream fixes.

## Rules
1. **Attribution stays.** Each vendored package keeps the upstream `LICENSE` and a header noting
   the source. MIT requires preserving the copyright notice.
2. **Record the source commit.** Each vendored package's README records `vendored from <repo> @ <sha>`.
3. **Sync, don't diverge silently.** Pull upstream via `git subtree pull` (or the recorded SHA +
   a manual diff) until we deliberately fork the behavior. Note divergences in the package README.
4. **Vendor incrementally.** Only what we edit or need; depend on the rest.

## Vendored packages

| chittie package | Upstream (MIT) | Source SHA | Notes |
|---|---|---|---|
| `@angadie/chittie-codepage` | `NielsLeenheer/CodepageEncoder` | `08e53e4` | vendored `src/` + `generated/` + `types/index.d.ts`; ships ESM source (no build step); zero-dep ✓ |
| `@angadie/chittie-core` | `NielsLeenheer/ReceiptPrinterEncoder` | `939d303` | vendored `src/` + `generated/`; codepage import repointed to `@angadie/chittie-codepage`; `structuredClone` shim for Hermes; `@canvas/image-data` ≥1.1.0 |

## How to re-sync (subtree)
```bash
# one-time, per vendored package:
git subtree add  --prefix=packages/chittie-codepage/upstream https://github.com/NielsLeenheer/CodepageEncoder main --squash
# later:
git subtree pull --prefix=packages/chittie-codepage/upstream https://github.com/NielsLeenheer/CodepageEncoder main --squash
```
(Exact layout TBD when we vendor — we may subtree into an `upstream/` subdir and re-export, or copy `src/` directly with the SHA recorded here.)
