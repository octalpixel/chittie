---
"@angadie/chittie-react": minor
---

Remove the unused `type` prop from `PrinterProps`. `render()` only ever read `<Printer width>`; `type` was never forwarded to the encoder, so setting it did nothing.
