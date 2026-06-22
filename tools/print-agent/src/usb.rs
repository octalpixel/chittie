//! Direct USB transport (nusb): bulk-write raw ESC/POS to a USB printer-class
//! device that exposes no OS print queue / COM port — e.g. the MINJCODE MJ5818.
//! macOS/Linux answer (proven on macOS: detach_and_claim + bulk-out, no sudo/CUPS).
//! On Windows the printers-crate queue path stays primary (nusb=WinUSB there needs
//! the device bound to the WinUSB driver).

use std::io::Write;

use nusb::MaybeFuture;
use nusb::descriptors::TransferType;
use nusb::transfer::{Bulk, Direction, Out};

const PRINTER_CLASS: u8 = 0x07; // bInterfaceClass for USB printers
const WRITE_BUFFER: usize = 8 * 1024; // receipts are tiny

pub struct UsbPrinter {
    pub name: String,
    pub vendor_id: u16,
    pub product_id: u16,
}

/// The printer-class interface number on a device, if any.
fn printer_interface(info: &nusb::DeviceInfo) -> Option<u8> {
    info.interfaces()
        .find(|i| i.class() == PRINTER_CLASS)
        .map(|i| i.interface_number())
}

/// Product name with a sane fallback.
fn printer_name(info: &nusb::DeviceInfo) -> String {
    info.product_string().unwrap_or("USB printer").to_string()
}

/// List connected USB devices that advertise a printer-class interface.
/// Cheap — reads OS enumeration metadata, no device is opened.
pub fn discover() -> Vec<UsbPrinter> {
    let Ok(devices) = nusb::list_devices().wait() else {
        return Vec::new();
    };
    devices
        .filter(|info| printer_interface(info).is_some())
        .map(|info| UsbPrinter {
            name: printer_name(&info),
            vendor_id: info.vendor_id(),
            product_id: info.product_id(),
        })
        .collect()
}

/// Write raw ESC/POS bytes to the first USB printer-class device found.
/// Returns the printer's product name on success.
pub fn print(data: &[u8]) -> Result<String, String> {
    let devices = nusb::list_devices().wait().map_err(|e| format!("list usb: {e}"))?;

    for info in devices {
        let Some(ifnum) = printer_interface(&info) else {
            continue;
        };
        let name = printer_name(&info);

        let dev = info.open().wait().map_err(|e| format!("open {name}: {e}"))?;
        let ep_addr = bulk_out_endpoint(&dev, ifnum)
            .ok_or_else(|| format!("{name}: no bulk OUT endpoint on interface {ifnum}"))?;

        // Detach the kernel/class driver and claim; fall back to a plain claim.
        let iface = dev
            .detach_and_claim_interface(ifnum)
            .wait()
            .or_else(|_| dev.claim_interface(ifnum).wait())
            .map_err(|e| format!("{name}: claim interface {ifnum}: {e}"))?;

        let endpoint = iface
            .endpoint::<Bulk, Out>(ep_addr)
            .map_err(|e| format!("{name}: open endpoint {ep_addr:#04x}: {e}"))?;

        let mut writer = endpoint.writer(WRITE_BUFFER);
        writer
            .write_all(data)
            .and_then(|_| writer.flush())
            .map_err(|e| format!("{name}: write: {e}"))?;

        return Ok(name);
    }

    Err("no USB printer-class device found".to_string())
}

/// Find the first bulk OUT endpoint address on the given interface number.
fn bulk_out_endpoint(dev: &nusb::Device, ifnum: u8) -> Option<u8> {
    for cfg in dev.configurations() {
        for alt in cfg.interface_alt_settings() {
            if alt.interface_number() != ifnum {
                continue;
            }
            for ep in alt.endpoints() {
                if matches!(ep.direction(), Direction::Out)
                    && matches!(ep.transfer_type(), TransferType::Bulk)
                {
                    return Some(ep.address());
                }
            }
        }
    }
    None
}
