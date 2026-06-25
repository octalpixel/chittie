---
"@angadie/chittie-transport": minor
---

Add optional `read(timeoutMs)` to the `Transport` contract and `queryStatus(transport)`
— writes the ESC/POS real-time status requests (`DLE EOT`) and parses the replies into
`{ online, coverOpen, paperOut, paperNearEnd, error, raw }`. Read-capable transports
(Web Serial, BLE notify, node USB bulk-in) get paper-out / cover-open detection; write-only
transports are unaffected (`print()` unchanged).
