# chittie v0.1 build — scratchpad (Kanban)

Verification = SPIKE-DRIVEN: run real vendored code → real ESC/POS bytes → escpos-emulator + RN-safety spikes (null Buffer/TextEncoder/react-dom). Tiny green commits.

## Doing
- WS0a chittie-codepage: vendor CodepageEncoder @08e53e4

## Backlog
- WS0b chittie-core: vendor ReceiptPrinterEncoder @939d303; repoint codepage import; RN gotchas (structuredClone guard, @canvas/image-data ≥1.1.0)
- WS1 chittie-react: pure JSX (no HTML host els) → drives core → bytes; render(); RN-safety spike
- WS2 chittie-transport: Transport iface + chunk() + print()
- WS3 chittie-transport-web: Web Serial/USB/Bluetooth
- WS4 chittie-transport-react-native: library-agnostic factory + MTU chunk
- WS5 chittie meta: re-export core + react
- VENDOR.md: record SHAs + attribution

## Done
- (scaffold + private repo already committed: b443fa7)

## Invariants
- no iconv/Buffer/react-dom in core or react; chittie-react zero HTML host elements
- vendored keeps LICENSE + SHA; no @ts-ignore/workarounds
