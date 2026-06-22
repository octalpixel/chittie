# Chittie Print Agent

A tiny (~540 KB), self-contained localhost service that lets a **web app print
raw ESC/POS** to a thermal printer that exposes **no serial/COM port** — e.g. a
USB printer-class device like the MINJCODE **MJ5818**. Browsers can't reach those
directly (and can't open raw TCP), so this agent receives the bytes over
`localhost` and writes them to the printer's OS queue (**Windows winspool RAW** /
**CUPS** on macOS/Linux).

It's the **bridge transport** for [chittie](../../): your web app builds ESC/POS
bytes with chittie, then POSTs them here. From the browser, use
`createBridgeTransport({ url })` in [`@angadie/chittie-transport-web`](../../packages/chittie-transport-web);
the [`tools/serial-mock`](../serial-mock) extension targets the **same contract** to
exercise the Web Serial path without hardware (run this agent in virtual mode).

```
web app (chittie) ──fetch http://localhost:8930/print {bytes}──► print-agent ──RAW──► printer queue
                  ◄──── GET /health (auto-detected) ────                       └──► or PNG (virtual mode)
```

## HTTP contract

| Method | Path        | Body / Result                                                                                                                   |
| ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/health`   | `{ ok, service, version, platform, mode }` (liveness — fast, no device enumeration)                                             |
| `GET`  | `/printers` | `{ printers: [...] }` — OS print queues **and** USB printer-class devices (`systemName:"usb"`, addressable via `printer:"usb"`) |
| `POST` | `/print`    | body `{ bytes: number[], printer?: string }` → raw-prints to `printer` (or default)                                             |

The app's `web/src/services/printerTransport.ts` points at `NEXT_PUBLIC_PRINT_BRIDGE_URL`
(default `http://localhost:8930`) and, if set, sends `NEXT_PUBLIC_PRINT_BRIDGE_TOKEN` as
the `x-agent-token` header.

## Virtual mode — for devs with no printer

Run with `PRINT_AGENT_VIRTUAL=1` and `/print` **renders the receipt to a PNG** instead of
printing — so a developer can see exactly what would print, no hardware required. The POS
app's bridge tier works unchanged (it just gets a `200`).

```bash
PRINT_AGENT_VIRTUAL=1 PRINT_AGENT_OUTPUT_DIR=./chittie-receipts ./chittie-print-agent
# each /print writes chittie-receipts/receipt-<timestamp>.png
```

The PNG uses a public-domain 8x8 bitmap font (no font asset) and renders alignment, bold,
the cut marker, and the cash-drawer-kick badge — the single renderer for both the bridge
path and the Web Serial path (the `serial-mock` extension forwards its bytes here).

## Configuration (environment variables)

| Var                        | Default             | Purpose                                                                                     |
| -------------------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| `PRINT_AGENT_PORT`         | `8930`              | Localhost port.                                                                             |
| `PRINT_AGENT_TOKEN`        | _(none)_            | Shared secret; if set, `/print` requires a matching `x-agent-token`. **Set in production.** |
| `PRINT_AGENT_ALLOW_ORIGIN` | `*`                 | `Access-Control-Allow-Origin`. Set to your POS origin in production.                        |
| `PRINT_AGENT_VIRTUAL`      | _(unset)_           | When set, render PNGs instead of printing (dev).                                            |
| `PRINT_AGENT_OUTPUT_DIR`   | `chittie-receipts` | Where virtual-mode PNGs are written.                                                        |

Security posture: binds **127.0.0.1 only** (never the network), 4 MiB body cap, optional
token, configurable CORS origin.

## Quick start (no Rust toolchain)

A prebuilt **macOS Apple-Silicon** binary is committed for instant use — no `cargo`:

```bash
# virtual mode (renders PNGs; great for dev with no printer)
PRINT_AGENT_VIRTUAL=1 ./prebuilt/chittie-print-agent-macos-arm64
# or print mode (drives a real/USB printer)
./prebuilt/chittie-print-agent-macos-arm64
```

> Only **macOS arm64** is committed (it's the dev machine; ~560 KB). For Windows/Linux/Intel,
> build below or grab a signed binary from the GitHub Release (canonical distribution).
> The prebuilt is a convenience and can lag `src/` — rebuild + recommit it when the agent
> changes, or just use a Release.

## Build

```bash
cd tools/print-agent
cargo build --release          # -> target/release/chittie-print-agent (~560 KB)
cargo clippy --release          # lint (clean)
```

## Releases (CI)

Tagging triggers `.github/workflows/print-agent-release.yml`, which cross-builds binaries
for **Windows (x64), macOS (Apple Silicon + Intel), and Linux (x64)** and publishes them
(with `.sha256` checksums) to a GitHub Release:

```bash
git tag print-agent-v0.1.0
git push origin print-agent-v0.1.0
```

To build a target locally instead:

```bash
rustup target add x86_64-pc-windows-msvc
cargo build --release --target x86_64-pc-windows-msvc   # -> chittie-print-agent.exe
```

## Distribution to clients / merchants

The merchant installs **one binary** (no Node/JVM/runtime). The `install/` scripts
do the auto-start setup for you — download the binary for the OS, then run the
matching script once:

```bash
# macOS / Linux
PRINT_AGENT_TOKEN=secret ./install/install-macos.sh ./chittie-print-agent
PRINT_AGENT_TOKEN=secret ./install/install-linux.sh ./chittie-print-agent
# Windows (PowerShell)
./install/install-windows.ps1 -BinPath .\chittie-print-agent.exe -Token secret
```

> The end goal is a **signed** installer (`.msi`/`.pkg`) that wraps these steps — without
> signing, Windows SmartScreen / macOS Gatekeeper warn the merchant. See "Releases" above;
> code-signing certs are the one paid prerequisite (Windows ~$120/yr via Azure Trusted
> Signing, macOS $99/yr Apple Developer; Linux needs none).

The manual equivalents (what the scripts do under the hood), per platform:

### Windows (the POSMAX target) — auto-start service

1. Download `chittie-print-agent-x86_64-pc-windows-msvc.exe` from the Release; verify the
   `.sha256`. Rename to `chittie-print-agent.exe`, place in `C:\Chittie\`.
2. Install the printer normally (Xprinter/vendor driver) so it shows in **Devices & Printers**.
3. Register auto-start (one-time, elevated terminal):
   ```bat
   sc create ChittiePrintAgent binPath= "C:\Chittie\chittie-print-agent.exe" start= auto
   sc start ChittiePrintAgent
   ```
   (or place a shortcut in `shell:startup`; or use NSSM for a friendlier service wrapper.)
4. Set a token for production: add `PRINT_AGENT_TOKEN` to the service environment and the
   matching `NEXT_PUBLIC_PRINT_BRIDGE_TOKEN` in the POS deploy.
5. Done — the POS web app auto-detects the agent via `/health` and prints silently.

### macOS — LaunchAgent

`~/Library/LaunchAgents/dev.angadie.chittie-print-agent.plist` running the binary with `RunAtLoad`

- `KeepAlive`, then `launchctl load` it.

### Linux — systemd user service

`~/.config/systemd/user/chittie-print-agent.service` with `Restart=always`, then
`systemctl --user enable --now chittie-print-agent`.

> A signed `.msi`/`.pkg` that bundles the steps above (and starts the service) is the
> ideal merchant experience and a follow-up release-pipeline task. The binary itself needs
> no installer to run.

## Local test (no hardware)

```bash
# print mode (errors gracefully if no printer queue exists)
PRINT_AGENT_PORT=8931 ./target/release/chittie-print-agent &
curl localhost:8931/health
curl -X POST localhost:8931/print -H 'content-type: application/json' \
  -d '{"bytes":[27,64,72,105,10],"printer":"YOUR_PRINTER_NAME"}'

# virtual mode (always works — writes a PNG)
PRINT_AGENT_PORT=8931 PRINT_AGENT_VIRTUAL=1 ./target/release/chittie-print-agent &
curl -X POST localhost:8931/print -H 'content-type: application/json' -d '{"bytes":[...]}'
```

The raw bytes → physical print path is exercised on a terminal where the printer is an
installed queue (verified target: Windows + MJ5818).

## Relationship to chittie

- **Build the bytes** with chittie (`@angadie/chittie` — JSX or builder → `Uint8Array`).
- **Send them** from the browser via `createBridgeTransport({ url })` in [`@angadie/chittie-transport-web`](../../packages/chittie-transport-web), which POSTs to this agent's `/print`.
- **Test without hardware** with the [`serial-mock`](../serial-mock) extension — it captures `navigator.serial` bytes and feeds them here in virtual mode (renders a PNG).
- This agent only **transports or renders** bytes — chittie builds them.
