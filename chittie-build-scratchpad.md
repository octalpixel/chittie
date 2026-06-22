# chittie v0.1 build — scratchpad (Kanban)

Verification = SPIKE-DRIVEN: run real vendored code → real ESC/POS bytes → escpos-emulator + RN-safety spikes (null Buffer/TextEncoder/react-dom). Tiny green commits.

## Doing

## Backlog
- WS0b chittie-core: vendor ReceiptPrinterEncoder @939d303; repoint codepage import; RN gotchas (structuredClone guard, @canvas/image-data ≥1.1.0)
- WS1 chittie-react: pure JSX (no HTML host els) → drives core → bytes; render(); RN-safety spike
- WS2 chittie-transport: Transport iface + chunk() + print()
- WS3 chittie-transport-web: Web Serial/USB/Bluetooth
- WS4 chittie-transport-react-native: library-agnostic factory + MTU chunk
- WS5 chittie meta: re-export core + react
- VENDOR.md: record SHAs + attribution

## Done
- scaffold + private repo (b443fa7)
- WS0a chittie-codepage (d8bf9df) — spike: cp437/cp858 bytes ✓
- WS0b chittie-core (d6100fa) — spike: real ESC/POS + RN-safe import; image deps file-level RN-verified
- WS1 chittie-react — KEYSTONE: JSX→367 bytes, Buffer/TextEncoder nulled, no react-dom ✓

## Invariants
- no iconv/Buffer/react-dom in core or react; chittie-react zero HTML host elements
- vendored keeps LICENSE + SHA; no @ts-ignore/workarounds
