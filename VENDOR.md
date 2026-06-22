# Vendoring & upstream-sync policy

chittie **vendors** a few MIT libraries (copies their source into this repo) rather than
depending on them, so we can edit freely without `patch-package`.

**Honest status: these are detached snapshots, not live links.** We copied the upstream `src/`
at a recorded commit SHA; there is **no `git subtree`/submodule** and no automatic sync. Re-syncing
is a deliberate manual step (below). We keep the SHA precisely so that manual diff stays cheap.

## Rules
1. **Attribution stays.** Each vendored package keeps the upstream `LICENSE` and notes the source.
   MIT requires preserving the copyright notice.
2. **Record the source commit.** The table below records `vendored from <repo> @ <sha>`.
3. **Don't silently diverge.** Keep edits to vendored code minimal and documented (e.g. the
   `structuredClone` shim is in our `src/index.js`, *not* in the vendored algorithm). Heavy edits
   make re-sync harder — prefer wrapping over editing.
4. **Vendor incrementally.** Only what we edit or need; depend on the rest.

## Vendored packages

| chittie package | Upstream (MIT) | Source SHA | Notes |
|---|---|---|---|
| `@angadie/chittie-codepage` | `NielsLeenheer/CodepageEncoder` | `08e53e4` | vendored `src/` + `generated/` + `types/index.d.ts`; ships ESM source (no build step); zero-dep ✓ |
| `@angadie/chittie-core` | `NielsLeenheer/ReceiptPrinterEncoder` | `939d303` | vendored `src/` + `generated/`; codepage import repointed to `@angadie/chittie-codepage`; `structuredClone` shim for Hermes; `@canvas/image-data` ≥1.1.0 |

## How to re-sync (manual — we are NOT using subtree)
We hold a detached copy at the recorded SHA. To pull upstream fixes:
```bash
# 1. fetch a fresh upstream at the new ref
git clone --depth 1 https://github.com/NielsLeenheer/CodepageEncoder /tmp/cpe
# 2. diff upstream's change since our recorded SHA (08e53e4) against our copy
git -C /tmp/cpe diff 08e53e4 HEAD -- src generated
# 3. hand-apply relevant hunks into packages/chittie-codepage/{src,generated}, keeping our edits
# 4. bump the SHA in the table below; run `pnpm check`
```
**If we later want true auto-sync**, convert a package to a real `git subtree`
(`git subtree add --prefix=packages/<pkg> <repo> main --squash`) — not done today.
