//! Chittie Companion — a Tauri desktop app that IS the print bridge + the dev
//! studio. It embeds `chittie_agent` (one Rust core): the diagnostics UI calls
//! the `print_escpos`/`list_printers` commands directly, and a background thread
//! runs the HTTP server so an *external* web POS (Safari/iPad, another browser)
//! can reach it on http://localhost:8930.

use std::thread;

use chittie_agent::core::{self, Target};
use chittie_agent::server::{run, ServeOptions};

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
    // Serve the HTTP API on a background thread so external browsers (a hosted web
    // POS, an iPad on the LAN) can print through this companion. The window's own
    // UI uses the Tauri commands above directly.
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
            // System tray (icon present once `tauri icon` has generated it).
            if let Some(icon) = app.default_window_icon().cloned() {
                tauri::tray::TrayIconBuilder::new()
                    .icon(icon)
                    .tooltip("Chittie Companion — printing on :8930")
                    .build(app)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![print_escpos, list_printers])
        .run(tauri::generate_context!())
        .expect("error while running Chittie Companion");
}
