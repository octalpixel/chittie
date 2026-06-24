# Chittie Companion (Tauri app)

The **turnkey print bridge + dev studio** for any web POS. One Rust core
(`chittie_agent`), three shells — this is shell **(b)**: a Tauri desktop app that

- **embeds the print core** — the in-window diagnostics UI calls `print_escpos` /
  `list_printers` Tauri commands directly (no IPC to a separate process);
- **runs the HTTP server** (`http://localhost:8930`) on a background thread, so an
  *external* web POS (a hosted browser, an iPad on the LAN) prints through it via
  `@angadie/chittie-companion`;
- lives in the **system tray**; the window is the diagnostics/studio (list printers,
  pin per station, test print).

It avoids ordereka's sidecar footgun (a separate always-spawned process that held an
update file-lock) — the server is *in* the app.

## Develop
```bash
# from apps/companion
npx @tauri-apps/cli icon icon.png        # one-time: generate src-tauri/icons (needs a 1024² source)
npx @tauri-apps/cli dev                  # run the app (loads ./dist)
npx @tauri-apps/cli build                # local bundle
```
The frontend is static (`dist/index.html`, vanilla JS) — no build step. Replace it
with a richer studio later; the Tauri commands + the `:8930` server are the contract.

## Release
Tag `companion-v*` → `.github/workflows/companion-release.yml` builds installers for
macOS / Windows / Linux via `tauri-action` (mirrors ordereka's proven Windows build).
**Prerequisite:** `src-tauri/icons/*` must be committed (run `tauri icon` once).

## Env
- `CHITTIE_PORT` (default 8930) · `CHITTIE_TOKEN` (x-agent-token) · `CHITTIE_VIRTUAL` (render PNGs, no printer).

> Status: **scaffolded** — Rust commands + embedded server + tray + a minimal diagnostics
> UI are in place and the core they call is unit-tested. The bundle/installer is produced by
> CI (Tauri builds need per-OS tooling + icons); verify the tray + on-device print on a real
> machine before release.
