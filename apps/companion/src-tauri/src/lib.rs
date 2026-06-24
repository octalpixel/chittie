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
            accent: "#0a0a0a".into(),
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

/// Print raw ESC/POS bytes to a target. `target: "virtual"` renders a PNG instead of
/// printing (the UI's Virtual-mode toggle) and returns its file path; otherwise writes
/// to the printer and returns the printer name.
#[tauri::command]
fn print_escpos(bytes: Vec<u8>, target: Option<String>) -> Result<String, String> {
    if target.as_deref() == Some("virtual") {
        use base64::Engine;
        let png = chittie_agent::render::render_png(&bytes, 48).map_err(|e| format!("render: {e}"))?;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&png);
        return Ok(format!("data:image/png;base64,{b64}"));
    }
    core::write_to_printer(&bytes, &Target::parse(target.as_deref())).map(|p| p.printer)
}

/// Every print destination (OS queues + direct-USB), for the pin/diagnostics screen.
#[tauri::command]
fn list_printers() -> Vec<serde_json::Value> {
    core::list_targets()
}

/// Run on login as a background menu-bar app (the "start automatically" toggle).
#[tauri::command]
fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let m = app.autolaunch();
    if enabled { m.enable() } else { m.disable() }.map_err(|e| e.to_string())
}

#[tauri::command]
fn autostart_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

/// Show + focus the main window (from the tray icon / menu).
fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
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
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let brand = load_branding();

            // Window title + tray tooltip from branding (runtime). The tray/installer
            // ICON is build-time (bundled) — per-brand builds swap it via `tauri icon`.
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_title(&brand.name);
            }

            // Tray menu: left-click (or "Open") shows the window; "Quit" actually exits.
            // Closing the window only hides it (see on_window_event) so the print server
            // keeps running in the background — the store owner sets it up once.
            let open_i = tauri::menu::MenuItem::with_id(app, "open", "Open Chittie", true, None::<&str>)?;
            let quit_i = tauri::menu::MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&open_i, &quit_i])?;
            if let Some(icon) = app.default_window_icon().cloned() {
                tauri::tray::TrayIconBuilder::new()
                    .icon(icon)
                    .tooltip(&brand.tooltip)
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "open" => show_main(app),
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            button_state: tauri::tray::MouseButtonState::Up,
                            ..
                        } = event
                        {
                            show_main(tray.app_handle());
                        }
                    })
                    .build(app)?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Hide to tray instead of quitting — keeps the print server alive so the
                // POS can still print even after the owner "closes" the window.
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![print_escpos, list_printers, branding, set_autostart, autostart_enabled])
        .run(tauri::generate_context!())
        .expect("error while running Chittie Companion");
}
