//! Chittie Companion — a Tauri desktop app that IS the print bridge + the dev
//! studio. It embeds `chittie_agent` (one Rust core): the diagnostics UI calls
//! the `print_escpos`/`list_printers` commands directly, and a background thread
//! runs the HTTP server so an *external* web POS (Safari/iPad, another browser)
//! can reach it on http://localhost:8930.
//!
//! White-labeling: the OS/installer icon is build-time (rebuild per brand with
//! `tauri icon <logo> && tauri build --config brands/<brand>.json`). The tray icon,
//! window title, and in-app UI are skinned at RUNTIME from a `branding.json`
//! (path via `CHITTIE_BRANDING`, else next to the binary) — no rebuild needed.

use std::thread;

use chittie_agent::core::{self, Target};
use chittie_agent::server::{run, ServeOptions};
use tauri::Manager;

/// Runtime branding — skins the tray/window/UI without a rebuild.
#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(default, rename_all = "camelCase")]
struct Branding {
    name: String,
    tooltip: String,
    /// Accent colour for the in-app UI (CSS).
    accent: String,
    /// Absolute path to a PNG logo for the tray + UI (optional; falls back to the bundled icon).
    logo_path: String,
}

impl Default for Branding {
    fn default() -> Self {
        Branding {
            name: "Chittie Companion".into(),
            tooltip: "Chittie Companion — printing on :8930".into(),
            accent: "#3b34c4".into(),
            logo_path: String::new(),
        }
    }
}

fn load_branding() -> Branding {
    let path = std::env::var("CHITTIE_BRANDING").unwrap_or_else(|_| "branding.json".into());
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

/// The in-app UI reads this to brand itself (name, accent, logo data URL).
#[tauri::command]
fn branding() -> Branding {
    load_branding()
}

/// Print raw ESC/POS or TSPL bytes to a target. Used by the in-app diagnostics UI
/// and any vendor frontend running inside this window.
#[tauri::command]
fn print_escpos(bytes: Vec<u8>, target: Option<String>) -> Result<String, String> {
    core::write_to_printer(&bytes, &Target::parse(target.as_deref())).map(|p| p.printer)
}

/// Every print destination (OS queues + direct-USB), for the pin/diagnostics screen.
#[tauri::command]
fn list_printers() -> Vec<serde_json::Value> {
    core::list_targets()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run_app() {
    thread::spawn(|| {
        let port = std::env::var("CHITTIE_PORT").ok().and_then(|s| s.parse().ok()).unwrap_or(8930);
        let token = std::env::var("CHITTIE_TOKEN").ok().filter(|s| !s.is_empty());
        let virtual_mode = std::env::var("CHITTIE_VIRTUAL").is_ok();
        if let Err(e) = run(ServeOptions { port, token, virtual_mode, ..Default::default() }) {
            eprintln!("[companion] server stopped: {e}");
        }
    });

    tauri::Builder::default()
        .setup(|app| {
            let brand = load_branding();

            // Window title + tray tooltip from branding (runtime). The tray/installer
            // ICON is build-time (bundled) — per-brand builds swap it via `tauri icon`.
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_title(&brand.name);
            }
            if let Some(icon) = app.default_window_icon().cloned() {
                tauri::tray::TrayIconBuilder::new().icon(icon).tooltip(&brand.tooltip).build(app)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![print_escpos, list_printers, branding])
        .run(tauri::generate_context!())
        .expect("error while running Chittie Companion");
}
