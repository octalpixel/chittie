# chittie print-agent — virtual printer port ("studio mode") + embedding guide

Two related goals:

1. **Make the agent trivial to copy/embed** (as ordereka did — lifting `usb.rs` into a Tauri
   `print_escpos` command).
2. **Register a *virtual printer* in the OS** — a "BlackHole for printers" — so *any* app can
   `Print → chittie` and the agent captures the bytes (→ PNG preview / studio / forward to a real
   device). This is the DX win: a virtual printer device, exactly like a virtual audio cable.

---

## Part 1 — The virtual printer port (how virtual audio cables do it, applied to printing)

**How virtual audio cables work:** BlackHole (macOS) is a CoreAudio *loopback driver*; VB-Cable
(Windows) is an audio driver. Each **registers a system device** that apps route to; the driver
hands the stream to userspace. We want the same: register a **print device** whose data lands in
the chittie agent.

The OS already has the mechanism — we don't need a kernel driver:

### macOS / Linux — a CUPS backend (raw queue)
CUPS pipes a print job to a **backend** executable. A **raw** queue (no filters) passes the bytes
through untouched — perfect for ESC/POS/TSPL. So: ship a `chittie` backend that forwards the job
to the agent's `/print`.

`/usr/lib/cups/backend/chittie` (macOS: `/usr/libexec/cups/backend/chittie`), `chmod 755`, root:
```sh
#!/bin/sh
# CUPS backend: device-discovery line + forward the raw job to the chittie agent.
if [ -z "$1" ]; then
  echo 'direct chittie "Unknown" "chittie virtual printer"'   # shows in the printer list
  exit 0
fi
# job data arrives on stdin (file $6 when present). POST it to the agent.
SRC="${6:-/dev/stdin}"
curl -s -X POST "http://127.0.0.1:8930/print-raw" --data-binary "@$SRC" \
  -H 'content-type: application/octet-stream' -H "x-print-token: $CHITTIE_TOKEN" >/dev/null
exit 0
```
Register the queue (raw, so bytes pass straight through):
```sh
lpadmin -p chittie -E -v chittie:/virtual -m raw
```
Now **“chittie” appears as a printer**; printing to it (raw ESC/POS/TSPL) reaches the agent.

### Windows — a redirected port monitor (RedMon, or a custom monitor)
RedMon (GPL, proven) creates a **redirected printer port**; attaching a *Generic / Text-Only*
driver to it pipes all data sent to the port into a program's stdin. Point that program at the
agent:
```
redmon port "RPT1:" → run: curl -s -X POST http://127.0.0.1:8930/print-raw --data-binary @- ...
```
Bundle a "chittie virtual printer" = Generic/Text driver + RedMon port. (A custom port-monitor DLL
is the no-dependency alternative; RedMon is the fast path.)

### What the agent does with it
Add a small **`POST /print-raw`** (octet-stream sibling of `/print`) so the OS backends can stream
bytes. Then the agent, by mode:
- **studio / virtual** (`PRINT_AGENT_VIRTUAL=1`) → render to PNG (already built) and (new) open/serve
  a live "what would print" view — the studio surface.
- **forward** → write to the configured real printer (queue/USB/TCP).

**Net:** `lpadmin … -m raw` (or the RedMon port) registers the device; `/print-raw` is the sink;
virtual mode makes it a studio. That's the virtual-cable parity, no kernel driver.

---

## Part 2 — Embedding the agent (copy it like ordereka did)

ordereka lifted `usb.rs` into a Tauri command in minutes. Make that the supported path:

**Module boundary (refactor target).** Keep the agent as a thin shell over an embeddable core:
- `core` (no HTTP): `render` (bytes→PNG, virtual), `usb` (nusb bulk-out), `queue` (printers-crate
  winspool/CUPS), `tcp` (raw :9100). Pure functions: `write_to_printer(bytes, target) -> Result`.
- `bin` (the shell): `tiny_http` server mapping `/health` `/printers` `/print` `/print-raw` → core.

Then embedders take `core` only:
- **Tauri**: `#[tauri::command] fn print_escpos(bytes, target)` → `core::write_to_printer` (ordereka).
- **CLI**: `chittie-print < bytes` → `core::write_to_printer`.
- **Service / sidecar**: the `bin` as-is.

**Vendoring guide (document in the README):**
1. Copy `src/{render,usb,queue,tcp}.rs` (the core) into your app.
2. Add deps: `nusb`, `printers`, `image`, `font8x8`.
3. Call `write_to_printer(&bytes, target)`; `target` = `None` (default queue→USB) | `"usb"` |
   `"name"` (queue) | `"host:port"` (TCP).
4. For non-USB targets you need nothing else; for direct USB on Windows the device needs WinUSB.

**Quirks to fix while we're here:**
- BITMAP/raster **bit polarity** is shared with chittie-label (dark→0, MSB-first) — factor a single
  documented packer so agent + chittie-label can't drift.
- `width = (w+7)/8` must floor → `(w+7)>>3` (the bug present in some TSPL ports).
- The committed `prebuilt/` can lag `src/` — CI should rebuild it on tag, and the README must say
  "prefer the Release binary; the committed one is dev-only, macOS-arm64."
- Document the **token** (`CHITTIE_TOKEN` / `x-print-token`) and **loopback-only** binding as the
  security posture (a virtual printer that any local process can reach must gate the cash-drawer
  pulse and cap body size — already done; state it).

---

## Status / next
- **Shipped:** `POST /print-raw` (the sink), the `core`/`bin` split (`core.rs` + `server.rs` +
  thin `main.rs`), and the **studio scripts** in `studio/`:
  - `studio/chittie-backend` — the CUPS backend (forwards a raw job to the agent), syntax-checked.
  - `studio/install-macos-linux.sh` — installs the backend + `lpadmin -m raw` (plus `uninstall`).
  - `studio/install-windows.md` — the RedMon redirected-port recipe.
- **Gated (needs the OS print stack + sudo + a device — not auto-verified):** running the installer
  (`lpadmin`/RedMon) and printing through the registered "Chittie" queue end-to-end; the optional
  studio live-view UI. Run `studio/install-macos-linux.sh` on a real machine to verify.
