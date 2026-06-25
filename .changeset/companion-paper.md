---
"@angadie/chittie-companion": minor
---

`Health` now carries `paper` ("58mm" | "80mm"). The companion/agent declares its paper
width on `/health` (via `CHITTIE_PAPER` / `PRINT_AGENT_PAPER`), so a POS can build the
receipt to the right column width instead of guessing — preventing the 58-vs-80mm wrap.
