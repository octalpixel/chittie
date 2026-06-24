//! Chittie print agent — standalone binary. A thin env-reader over
//! `chittie_agent::server`; the same server is embedded by the Tauri companion app.

use std::path::PathBuf;

use chittie_agent::server::{run, ServeOptions};

fn main() {
    let opts = ServeOptions {
        port: std::env::var("PRINT_AGENT_PORT").ok().and_then(|s| s.parse().ok()).unwrap_or(8930),
        token: std::env::var("PRINT_AGENT_TOKEN").ok().filter(|s| !s.is_empty()),
        allow_origin: std::env::var("PRINT_AGENT_ALLOW_ORIGIN").unwrap_or_else(|_| "*".into()),
        virtual_mode: std::env::var("PRINT_AGENT_VIRTUAL").is_ok(),
        out_dir: std::env::var("PRINT_AGENT_OUTPUT_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("chittie-receipts")),
    };
    if let Err(e) = run(opts) {
        eprintln!("[print-agent] fatal: {e}");
        std::process::exit(1);
    }
}
