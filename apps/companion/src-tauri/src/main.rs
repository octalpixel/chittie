// Hide the extra console window on Windows in release builds (use the GUI subsystem).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Chittie Companion desktop entry point.
fn main() {
    chittie_companion_lib::run_app()
}
