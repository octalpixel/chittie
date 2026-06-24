//! Embeddable transport core — no HTTP, no env, the only code that touches the
//! printer. Lift this (with `render.rs` + `usb.rs`) into a Tauri command / CLI.

use std::io::Write;

use printers::common::base::job::PrinterJobOptions;
use serde_json::json;

use crate::usb;

/// Where to deliver the bytes. Parse from the wire with [`Target::parse`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Target {
    /// Default OS print queue, falling back to direct USB.
    Default,
    /// Direct USB printer-class device (nusb bulk-out).
    Usb,
    /// A named OS print queue (winspool / CUPS).
    Queue(String),
    /// Raw TCP to a network printer — `"host:port"` (e.g. `192.168.1.50:9100`).
    Tcp(String),
}

impl Target {
    /// `None`/`""` → Default · `"usb"` → Usb · `"host:port"` (numeric port) → Tcp · else Queue name.
    pub fn parse(target: Option<&str>) -> Target {
        match target {
            None | Some("") => Target::Default,
            Some("usb") => Target::Usb,
            Some(t) if is_host_port(t) => Target::Tcp(t.to_string()),
            Some(name) => Target::Queue(name.to_string()),
        }
    }
}

/// "host:port" with a non-empty host and a numeric port — a network printer.
/// A queue name that merely contains a colon (e.g. "Front: Receipt") is not TCP.
fn is_host_port(t: &str) -> bool {
    t.rsplit_once(':')
        .is_some_and(|(host, port)| !host.is_empty() && port.parse::<u16>().is_ok())
}

/// A successful write: which transport carried it, and the resolved printer name.
pub struct Printed {
    pub transport: &'static str,
    pub printer: String,
}

/// Deliver raw bytes to the target printer — the single hardware entry point.
/// Returns the transport + printer name (so callers can show "✓ Printed → X"),
/// or a clear error (never a silent fallback to the OS default).
pub fn write_to_printer(bytes: &[u8], target: &Target) -> Result<Printed, String> {
    if bytes.is_empty() {
        return Err("empty payload".into());
    }
    match target {
        Target::Tcp(addr) => {
            let mut s =
                std::net::TcpStream::connect(addr).map_err(|e| format!("tcp connect {addr}: {e}"))?;
            s.write_all(bytes).map_err(|e| format!("tcp write: {e}"))?;
            Ok(Printed { transport: "tcp", printer: addr.clone() })
        }
        Target::Usb => usb::print(bytes).map(|printer| Printed { transport: "usb", printer }),
        Target::Queue(name) => {
            let printer = printers::get_printers()
                .into_iter()
                .find(|p| &p.name == name || &p.system_name == name)
                .ok_or_else(|| format!("printer '{name}' not found"))?;
            let mut opts = PrinterJobOptions::none(); // Converter::None => raw ESC/POS passthrough
            opts.name = Some("Chittie receipt");
            printer.print(bytes, opts).map_err(|e| format!("{e:?}"))?;
            Ok(Printed { transport: "print", printer: printer.name })
        }
        Target::Default => match printers::get_default_printer() {
            Some(printer) => {
                let mut opts = PrinterJobOptions::none();
                opts.name = Some("Chittie receipt");
                printer.print(bytes, opts).map_err(|e| format!("{e:?}"))?;
                Ok(Printed { transport: "print", printer: printer.name })
            }
            None => usb::print(bytes)
                .map(|printer| Printed { transport: "usb", printer })
                .map_err(|e| format!("no default print queue and no USB printer ({e})")),
        },
    }
}

/// Every print destination: OS print queues + direct-USB printer-class devices.
pub fn list_targets() -> Vec<serde_json::Value> {
    let mut out: Vec<serde_json::Value> = printers::get_printers()
        .into_iter()
        .map(|p| json!({ "name": p.name, "systemName": p.system_name, "isDefault": p.is_default }))
        .collect();
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_targets() {
        assert!(matches!(Target::parse(None), Target::Default));
        assert!(matches!(Target::parse(Some("")), Target::Default));
        assert!(matches!(Target::parse(Some("usb")), Target::Usb));
        assert_eq!(Target::parse(Some("192.168.1.50:9100")), Target::Tcp("192.168.1.50:9100".into()));
        assert_eq!(Target::parse(Some("XP-365B")), Target::Queue("XP-365B".into()));
        // a queue name with a colon but no numeric port is NOT tcp
        assert!(matches!(Target::parse(Some("Front: Receipt")), Target::Queue(_)));
        assert!(matches!(Target::parse(Some("Microsoft Print to PDF")), Target::Queue(_)));
    }

    #[test]
    fn empty_payload_errors() {
        assert!(write_to_printer(&[], &Target::Default).is_err());
    }
}
