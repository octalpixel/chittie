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

## Run locally (macOS / your dev machine) — no CI needed
```bash
cd apps/companion
npm install            # @tauri-apps/cli
npm run dev            # live dev: opens the window, server on :8930, hot-reloads ./dist
npm run build:app      # build a local .app  → src-tauri/target/debug/bundle/macos/
CHITTIE_VIRTUAL=1 npm run dev   # test with no printer (renders PNGs instead of printing)
```
CI is only for cross-OS *installers* (mac+win+linux at once). A single-OS build/run is local.
Icons are committed; regenerate with `npm run icon` after changing `branding/logo.png`.
The static frontend uses the global Tauri API, so `app.withGlobalTauri` is enabled in the config.
The frontend is static (`dist/index.html`, vanilla JS) — no build step. Replace it
with a richer studio later; the Tauri commands + the `:8930` server are the contract.

## Release
Tag `companion-v*` → `.github/workflows/companion-release.yml` builds installers for
macOS / Windows / Linux via `tauri-action` (mirrors ordereka's proven Windows build).
**Prerequisite:** `src-tauri/icons/*` must be committed (run `tauri icon` once).

## Env
- `CHITTIE_PORT` (default 8930) · `CHITTIE_TOKEN` (x-agent-token) · `CHITTIE_VIRTUAL` (render PNGs, no printer) · `CHITTIE_BRANDING` (path to a branding.json).

## White-labeling (two layers)
The **OS/installer icon + app name** are build-time; the **tray icon, window title, and in-app UI**
skin at runtime.

**Runtime (no rebuild)** — point `CHITTIE_BRANDING` at a JSON (or drop `branding.json` next to the
binary). It re-skins the tray tooltip + logo, window title, and the diagnostics UI (name, accent,
logo). See `brands/acme.branding.json`:
```bash
CHITTIE_BRANDING=brands/acme.branding.json <chittie-companion>
```

**Per-brand build (own dock/installer icon + app name)** — generate the icon set from the brand's
logo and build with a config override:
```bash
npx @tauri-apps/cli icon brand-logo.png --output src-tauri/icons/acme
npx @tauri-apps/cli build --config brands/acme.json   # productName, identifier, bundle.icon
```
`brands/acme.json` overrides `productName` / `identifier` / `bundle.icon`; the runtime
`brands/acme.branding.json` skins the live app. A CI matrix (one row per brand → its logo + config)
produces a branded installer per partner. The default chittie icons live in `src-tauri/icons/`
(generated from `branding/logo.png`).

> Status: **scaffolded** — Rust commands + embedded server + tray + a minimal diagnostics
> UI are in place and the core they call is unit-tested. The bundle/installer is produced by
> CI (Tauri builds need per-OS tooling + icons); verify the tray + on-device print on a real
> machine before release.
