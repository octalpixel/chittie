//! Chittie print agent — a tiny localhost service that receives raw ESC/POS
//! bytes from the POS web app and either writes them straight to a thermal
//! printer's OS queue (Windows winspool RAW / CUPS) or, in virtual mode,
//! renders them to a PNG so devs without a printer can see the receipt.
//!
//! Contract (shared with the dev serial-mock and the future Tauri bridge):
//!   GET  /health   -> { ok, service, version, platform, mode, defaultPrinter, printers }
//!   GET  /printers -> { printers: [{ name, systemName, isDefault }] }
//!   POST /print    -> { bytes: number[], printer?: string }  (raw ESC/POS)

mod render;
mod usb;

use std::io::{Cursor, Read};
use std::net::Ipv4Addr;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use printers::common::base::job::PrinterJobOptions;
use serde::Deserialize;
use serde_json::json;
use tiny_http::{Header, Method, Request, Response, Server};

const VERSION: &str = env!("CARGO_PKG_VERSION");
const DEFAULT_PORT: u16 = 8930;
const MAX_BODY: u64 = 4 * 1024 * 1024; // 4 MiB cap — receipts are tiny.
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

    // Bind to loopback only — never expose the printer to the network.
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
    println!(
        "[print-agent] auth: {}",
        if cfg.token.is_some() {
            "x-agent-token required"
        } else {
            "none (set PRINT_AGENT_TOKEN for production)"
        }
    );

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
        (Method::Get, "/printers") => json_response(200, json!({ "printers": list_printers() }), cfg),
        (Method::Post, "/print") => handle_print(request, cfg),
        _ => json_response(404, json!({ "ok": false, "error": "not found" }), cfg),
    }
}

fn handle_print(request: &mut Request, cfg: &Config) -> Resp {
    if let Some(expected) = cfg.token.as_deref()
        && header(request, "x-agent-token").as_deref() != Some(expected)
    {
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
    if req.bytes.is_empty() {
        return json_response(400, json!({ "ok": false, "error": "empty payload" }), cfg);
    }

    let want_virtual = cfg.virtual_mode || req.printer.as_deref() == Some("virtual");
    if want_virtual {
        return render_virtual(&req.bytes, cfg);
    }

    // Direct USB (printer-class device with no OS queue, e.g. MJ5818 on macOS/Linux).
    if req.printer.as_deref() == Some("usb") {
        return match usb::print(&req.bytes) {
            Ok(name) => json_response(
                200,
                json!({ "ok": true, "transport": "usb", "printer": name, "bytes": req.bytes.len() }),
                cfg,
            ),
            Err(e) => json_response(500, json!({ "ok": false, "error": e }), cfg),
        };
    }

    let target = match &req.printer {
        Some(name) => printers::get_printers()
            .into_iter()
            .find(|p| &p.name == name || &p.system_name == name),
        None => printers::get_default_printer(),
    };
    let Some(printer) = target else {
        // No OS print queue matched. On macOS/Linux a USB printer-class device
        // (e.g. MJ5818) exposes no queue, so fall back to direct USB — this lets
        // the web app print with just {bytes} and no platform-specific routing.
        return match usb::print(&req.bytes) {
            Ok(name) => json_response(
                200,
                json!({ "ok": true, "transport": "usb", "printer": name, "bytes": req.bytes.len() }),
                cfg,
            ),
            Err(usb_err) => json_response(
                404,
                json!({ "ok": false, "error": format!("no OS print queue and no USB printer ({usb_err})") }),
                cfg,
            ),
        };
    };

    let mut opts = PrinterJobOptions::none(); // Converter::None => raw ESC/POS passthrough
    opts.name = Some("Chittie receipt");
    match printer.print(&req.bytes, opts) {
        Ok(_) => json_response(
            200,
            json!({ "ok": true, "transport": "print", "printer": printer.name, "bytes": req.bytes.len() }),
            cfg,
        ),
        Err(e) => json_response(
            500,
            json!({ "ok": false, "printer": printer.name, "error": format!("{e:?}") }),
            cfg,
        ),
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
                json!({ "ok": true, "transport": "virtual", "file": path.to_string_lossy(), "bytes": bytes.len() }),
                cfg,
            )
        }
        Err(e) => json_response(500, json!({ "ok": false, "error": format!("render: {e}") }), cfg),
    }
}

fn list_printers() -> Vec<serde_json::Value> {
    let mut out: Vec<serde_json::Value> = printers::get_printers()
        .into_iter()
        .map(|p| json!({ "name": p.name, "systemName": p.system_name, "isDefault": p.is_default }))
        .collect();
    // USB printer-class devices addressable via the direct-USB transport (printer:"usb").
    for u in usb::discover() {
        out.push(json!({
            "name": format!("{} (USB)", u.name),
            "systemName": "usb",
            "isDefault": false,
            "transport": "usb",
            "vendorId": u.vendor_id,
            "productId": u.product_id,
        }));
    }
    out
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
        (b"Access-Control-Allow-Headers", b"content-type, x-agent-token"),
        (b"Access-Control-Allow-Origin", cfg.allow_origin.as_bytes()),
    ];
    for (field, value) in headers {
        if let Ok(h) = Header::from_bytes(field, value) {
            res.add_header(h);
        }
    }
    res
}
