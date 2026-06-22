# tools

Non-npm artifacts that support chittie but aren't part of the pnpm workspace (they're not TypeScript libraries, so they don't belong in [`packages/`](../packages)).

| Tool | What | Why it's here, not in `packages/` |
|---|---|---|
| [`print-agent`](./print-agent) | A tiny Rust localhost service that raw-prints ESC/POS to a USB/queue printer (or renders a PNG). | A **native binary**, distributed as a GitHub Release / installer to merchants — not an npm package. |
| [`serial-mock`](./serial-mock) | A Chrome MV3 extension that mocks `navigator.serial` and forwards bytes to `print-agent`. | A **browser extension** (loaded unpacked / Web Store) — not an npm package. **Dev-only.** |

The **npm-publishable glue lives in `packages/`**: `createBridgeTransport()` in [`@angadie/chittie-transport-web`](../packages/chittie-transport-web) is the browser client that talks to `print-agent`'s HTTP contract.

```
chittie (build bytes) ──► createBridgeTransport ──HTTP──► tools/print-agent ──► USB/queue printer
                                                  ▲
                          tools/serial-mock (dev) ─┘  mocks navigator.serial → feeds the agent
```

`serial-mock` is the **only** way to exercise chittie's Web Serial transport in a real browser without a serial printer (browsers only enumerate driver-backed ports). For non-browser previews, [`@angadie/chittie-preview`](../packages/chittie-preview) renders bytes → image directly.
