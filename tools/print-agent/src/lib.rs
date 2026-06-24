//! chittie print-agent — embeddable core.
//!
//! The HTTP shell (`src/main.rs`) is a thin layer over this. Embedders — a Tauri
//! `print_escpos` command, a CLI, a service — depend on `core` directly:
//!
//! ```ignore
//! use chittie_agent::core::{write_to_printer, Target};
//! let printed = write_to_printer(&bytes, &Target::parse(target.as_deref()))?;
//! ```
//!
//! The byte-builder is JavaScript (`@angadie/chittie-core`). This crate only
//! *delivers* those bytes to hardware (OS print queue / USB / TCP) and renders
//! a virtual PNG for previewing without a printer.

pub mod core;
pub mod render;
pub mod server;
pub mod usb;
