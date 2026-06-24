# Companion — product & distribution decisions

The companion's user is a **non-technical store owner**, not a developer. These decisions follow
from that (design-psychology: design for the real person, not yourself).

## One app, two surfaces — NOT two apps
Two GUI apps (one "developer", one "store owner") would mean 2× installers, signing, CI, update
channels, support, and drift — for code that's ~90% shared (same Rust core + HTTP server). Instead:

- **The GUI companion is store-owner-first.** Default surface: a big plain-language **status**
  ("Ready to print"), one **"Print a test receipt"** button, **"Choose your printer"** (friendly
  names, no USB/queue/TCP/target jargon), and **"Start automatically"**.
- **The cockpit lives under "Advanced (for setup engineers)"** — raw printer list + system names,
  virtual mode + preview, the `:8930` server, per-station notes. Progressive disclosure.
- **The developer tool already exists** and isn't a GUI: the headless `chittie-print-agent` binary,
  the `@angadie/chittie-companion` SDK, and the print-agent core to embed. So devs/integrators use
  the SDK/CLI/Advanced panel; we don't build a second app.

## Background process (auto-start) — yes, essential
A store owner won't open an app each morning. The companion:
- **Starts on login** via `tauri-plugin-autostart` — toggled in-app ("Start automatically when I
  turn on this computer"); default on after first setup.
- **Lives in the menu-bar/tray** (the window is the control panel, not a thing they keep open).
- Commands: `set_autostart(enabled)` / `autostart_enabled()` (Rust, calls the plugin).

## Distribution for non-technical owners (web POS)
1. **Signed + notarized installers** (macOS notarization, Windows code signing). Non-negotiable —
   an unsigned app hits Gatekeeper/SmartScreen warnings a non-technical user can't get past.
2. **Friendly first run**: find printer → print test → "start automatically" → done. Then it's in
   the menu bar and they forget about it.
3. **Auto-update** (the Tauri updater + signed `latest.json`, as ordereka does) — owners never
   manually update.
4. **The POS vendor links merchants to the installer** (or bundles it). The hosted web POS in any
   browser reaches `http://localhost:8930` (allowed by every browser; works on Safari/iPad too,
   where direct Web Serial/USB doesn't exist).

## Design language (store-owner UI)
Dependency-free static HTML (the webview loads it directly — no React/Tailwind/bundler for a
one-screen utility; native system font makes it feel like a real desktop app). Neutral base + one
accent (brand indigo), generous spacing, designed empty/loading/error states, plain language. The
brand name/accent/logo are runtime (`branding.json`) so partners re-skin without a rebuild.

## Status
Shipped: store-owner UI (status/test/choose-printer/auto-start) + Advanced cockpit + autostart
plugin + capabilities. Pending (hardware/CI): signing+notarization, the auto-updater wiring, and
on-device verification with a real printer.
