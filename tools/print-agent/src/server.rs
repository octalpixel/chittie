//! The localhost HTTP server over [`crate::core`]. Used by the standalone binary
//! and embedded by the Tauri companion app (call [`run`] on a background thread).

use std::io::{Cursor, Read};
use std::net::Ipv4Addr;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Deserialize;
use serde_json::json;
use tiny_http::{Header, Method, Request, Response, Server};

use crate::{core, render};

const VERSION: &str = env!("CARGO_PKG_VERSION");
const MAX_BODY: u64 = 4 * 1024 * 1024; // 4 MiB cap — receipts/labels are tiny.
const RECEIPT_WIDTH_CHARS: u32 = 48; // 80mm roll

type Resp = Response<Cursor<Vec<u8>>>;

/// Server configuration (env-free so embedders can build it directly).
pub struct ServeOptions {
    pub port: u16,
    pub token: Option<String>,
    pub allow_origin: String,
    pub virtual_mode: bool,
    pub out_dir: PathBuf,
}

impl Default for ServeOptions {
    fn default() -> Self {
        ServeOptions {
            port: 8930,
            token: None,
            allow_origin: "*".into(),
            virtual_mode: false,
            out_dir: PathBuf::from("chittie-receipts"),
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PrintRequest {
    bytes: Vec<u8>,
    #[serde(default)]
    printer: Option<String>,
}

/// Bind to loopback and serve forever. Blocks — run on its own thread when embedded.
pub fn run(opts: ServeOptions) -> std::io::Result<()> {
    if opts.virtual_mode {
        std::fs::create_dir_all(&opts.out_dir)?;
    }
    let server = Server::http((Ipv4Addr::LOCALHOST, opts.port))
        .map_err(|e| std::io::Error::other(e.to_string()))?;
    println!(
        "[print-agent] v{VERSION} on http://127.0.0.1:{} ({}) — mode: {}",
        opts.port,
        std::env::consts::OS,
        if opts.virtual_mode { "VIRTUAL (renders PNG)" } else { "print" }
    );
    loop {
        match server.recv() {
            Ok(mut request) => {
                let response = route(&mut request, &opts);
                if let Err(e) = request.respond(response) {
                    eprintln!("[print-agent] respond error: {e}");
                }
            }
            Err(e) => eprintln!("[print-agent] recv error: {e}"),
        }
    }
}

fn route(request: &mut Request, cfg: &ServeOptions) -> Resp {
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

fn handle_print(request: &mut Request, cfg: &ServeOptions) -> Resp {
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

fn handle_print_raw(request: &mut Request, cfg: &ServeOptions) -> Resp {
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

fn deliver(bytes: &[u8], target: Option<&str>, cfg: &ServeOptions) -> Resp {
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

fn render_virtual(bytes: &[u8], cfg: &ServeOptions) -> Resp {
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    let path = cfg.out_dir.join(format!("receipt-{stamp}.png"));
    match render::render_png_to(bytes, &path, RECEIPT_WIDTH_CHARS) {
        Ok(()) => json_response(
            200,
            json!({ "ok": true, "transport": "virtual", "printer": path.to_string_lossy(), "bytes": bytes.len() }),
            cfg,
        ),
        Err(e) => json_response(500, json!({ "ok": false, "error": format!("render: {e}") }), cfg),
    }
}

fn authorized(request: &Request, cfg: &ServeOptions) -> bool {
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

fn json_response(status: u16, body: serde_json::Value, cfg: &ServeOptions) -> Resp {
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
