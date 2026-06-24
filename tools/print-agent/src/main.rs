//! Chittie print agent — a tiny localhost HTTP shell over `chittie_agent::core`.
//! Receives raw ESC/POS bytes from the POS web app and delivers them to a
//! printer (OS queue / USB / TCP), or renders a virtual PNG in `--virtual` mode.
//!
//! Contract:
//!   GET  /health    -> { ok, service, version, platform, mode }
//!   GET  /printers  -> { printers: [{ name, systemName, isDefault, ... }] }
//!   POST /print     -> { bytes: number[], printer?: string }   (JSON)
//!   POST /print-raw -> raw body (application/octet-stream), target via x-print-target
//! Both print routes return { ok, transport, printer, bytes } so callers can show
//! exactly where each job went (never a silent fallback).

use std::io::{Cursor, Read};
use std::net::Ipv4Addr;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use chittie_agent::{core, render};
use serde::Deserialize;
use serde_json::json;
use tiny_http::{Header, Method, Request, Response, Server};

const VERSION: &str = env!("CARGO_PKG_VERSION");
const DEFAULT_PORT: u16 = 8930;
const MAX_BODY: u64 = 4 * 1024 * 1024; // 4 MiB cap — receipts/labels are tiny.
const RECEIPT_WIDTH_CHARS: u32 = 48; // 80mm roll

type Resp = Response<Cursor<Vec<u8>>>;

struct Config {
    token: Option<String>,
    allow_origin: String,
    virtual_mode: bool,
    out_dir: PathBuf,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PrintRequest {
    bytes: Vec<u8>,
    #[serde(default)]
    printer: Option<String>,
}

fn main() {
    let port = std::env::var("PRINT_AGENT_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(DEFAULT_PORT);
    let out_dir = std::env::var("PRINT_AGENT_OUTPUT_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("chittie-receipts"));
    let cfg = Config {
        token: std::env::var("PRINT_AGENT_TOKEN").ok().filter(|s| !s.is_empty()),
        allow_origin: std::env::var("PRINT_AGENT_ALLOW_ORIGIN").unwrap_or_else(|_| "*".into()),
        virtual_mode: std::env::var("PRINT_AGENT_VIRTUAL").is_ok(),
        out_dir,
    };

    if cfg.virtual_mode
        && let Err(e) = std::fs::create_dir_all(&cfg.out_dir)
    {
        eprintln!("[print-agent] cannot create output dir {:?}: {e}", cfg.out_dir);
        std::process::exit(1);
    }

    let server = match Server::http((Ipv4Addr::LOCALHOST, port)) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[print-agent] failed to bind 127.0.0.1:{port}: {e}");
            std::process::exit(1);
        }
    };

    println!(
        "[print-agent] v{VERSION} on http://127.0.0.1:{port} ({}) — mode: {}",
        std::env::consts::OS,
        if cfg.virtual_mode { "VIRTUAL (renders PNG)" } else { "print" }
    );
    if cfg.virtual_mode {
        println!("[print-agent] virtual output -> {:?}", cfg.out_dir);
    }

    loop {
        match server.recv() {
            Ok(mut request) => {
                let response = route(&mut request, &cfg);
                if let Err(e) = request.respond(response) {
                    eprintln!("[print-agent] respond error: {e}");
                }
            }
            Err(e) => eprintln!("[print-agent] recv error: {e}"),
        }
    }
}

fn route(request: &mut Request, cfg: &Config) -> Resp {
    let method = request.method().clone();
    let path = request.url().split('?').next().unwrap_or("").to_string();

    match (&method, path.as_str()) {
        (Method::Options, _) => json_response(204, json!({}), cfg),
        (Method::Get, "/health") => json_response(
            200,
            json!({
                "ok": true,
                "service": "chittie-print-agent",
                "version": VERSION,
                "platform": std::env::consts::OS,
                "mode": if cfg.virtual_mode { "virtual" } else { "print" },
            }),
            cfg,
        ),
        (Method::Get, "/printers") => json_response(200, json!({ "printers": core::list_targets() }), cfg),
        (Method::Post, "/print") => handle_print(request, cfg),
        (Method::Post, "/print-raw") => handle_print_raw(request, cfg),
        _ => json_response(404, json!({ "ok": false, "error": "not found" }), cfg),
    }
}

fn handle_print(request: &mut Request, cfg: &Config) -> Resp {
    if !authorized(request, cfg) {
        return json_response(401, json!({ "ok": false, "error": "unauthorized" }), cfg);
    }
    let mut body = Vec::new();
    if let Err(e) = request.as_reader().take(MAX_BODY).read_to_end(&mut body) {
        return json_response(400, json!({ "ok": false, "error": format!("read body: {e}") }), cfg);
    }
    let req: PrintRequest = match serde_json::from_slice(&body) {
        Ok(r) => r,
        Err(e) => return json_response(400, json!({ "ok": false, "error": format!("bad json: {e}") }), cfg),
    };
    deliver(&req.bytes, req.printer.as_deref(), cfg)
}

fn handle_print_raw(request: &mut Request, cfg: &Config) -> Resp {
    if !authorized(request, cfg) {
        return json_response(401, json!({ "ok": false, "error": "unauthorized" }), cfg);
    }
    let target = header(request, "x-print-target");
    let mut body = Vec::new();
    if let Err(e) = request.as_reader().take(MAX_BODY).read_to_end(&mut body) {
        return json_response(400, json!({ "ok": false, "error": format!("read body: {e}") }), cfg);
    }
    deliver(&body, target.as_deref(), cfg)
}

/// Shared delivery: virtual PNG, or hand off to the core and report where it went.
fn deliver(bytes: &[u8], target: Option<&str>, cfg: &Config) -> Resp {
    if bytes.is_empty() {
        return json_response(400, json!({ "ok": false, "error": "empty payload" }), cfg);
    }
    if cfg.virtual_mode || target == Some("virtual") {
        return render_virtual(bytes, cfg);
    }
    match core::write_to_printer(bytes, &core::Target::parse(target)) {
        Ok(p) => json_response(
            200,
            json!({ "ok": true, "transport": p.transport, "printer": p.printer, "bytes": bytes.len() }),
            cfg,
        ),
        Err(e) => json_response(500, json!({ "ok": false, "error": e }), cfg),
    }
}

fn render_virtual(bytes: &[u8], cfg: &Config) -> Resp {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let path = cfg.out_dir.join(format!("receipt-{stamp}.png"));
    match render::render_png_to(bytes, &path, RECEIPT_WIDTH_CHARS) {
        Ok(()) => {
            println!("[print-agent] virtual receipt -> {}", path.display());
            json_response(
                200,
                json!({ "ok": true, "transport": "virtual", "printer": path.to_string_lossy(), "bytes": bytes.len() }),
                cfg,
            )
        }
        Err(e) => json_response(500, json!({ "ok": false, "error": format!("render: {e}") }), cfg),
    }
}

fn authorized(request: &Request, cfg: &Config) -> bool {
    match cfg.token.as_deref() {
        Some(expected) => header(request, "x-agent-token").as_deref() == Some(expected),
        None => true,
    }
}

fn header(request: &Request, name: &str) -> Option<String> {
    request
        .headers()
        .iter()
        .find(|h| h.field.as_str().as_str().eq_ignore_ascii_case(name))
        .map(|h| h.value.as_str().to_string())
}

fn json_response(status: u16, body: serde_json::Value, cfg: &Config) -> Resp {
    let mut res = Response::from_string(body.to_string()).with_status_code(status);
    let headers: [(&[u8], &[u8]); 4] = [
        (b"Content-Type", b"application/json"),
        (b"Access-Control-Allow-Methods", b"GET, POST, OPTIONS"),
        (b"Access-Control-Allow-Headers", b"content-type, x-agent-token, x-print-target"),
        (b"Access-Control-Allow-Origin", cfg.allow_origin.as_bytes()),
    ];
    for (field, value) in headers {
        if let Ok(h) = Header::from_bytes(field, value) {
            res.add_header(h);
        }
    }
    res
}
