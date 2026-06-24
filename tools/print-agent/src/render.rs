//! Virtual-printer rendering: turn raw ESC/POS bytes into a PNG receipt so devs
//! without a physical printer can see output. Handles the text subset the POS
//! emits (align / bold / line-feed / cut / drawer) — same scope as the
//! serial-mock HTML renderer. Uses an 8x8 public-domain bitmap font (no asset).

use std::path::Path;

use font8x8::legacy::BASIC_LEGACY;
use image::{ImageError, ImageFormat, Rgba, RgbaImage};

#[derive(Clone, Copy, PartialEq)]
enum Align {
    Left,
    Center,
    Right,
}

struct Line {
    text: String,
    align: Align,
    bold: bool,
}

struct Receipt {
    lines: Vec<Line>,
    cut: bool,
    drawer: bool,
}

fn parse(bytes: &[u8]) -> Receipt {
    let mut lines = Vec::new();
    let mut cur = String::new();
    let mut align = Align::Left;
    let mut bold = false;
    let mut cut = false;
    let mut drawer = false;
    let at = |k: usize| bytes.get(k).copied().unwrap_or(0);

    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            0x1b => match at(i + 1) {
                0x40 => {
                    align = Align::Left;
                    bold = false;
                    i += 2;
                } // ESC @  init
                0x61 => {
                    align = match at(i + 2) {
                        1 => Align::Center,
                        2 => Align::Right,
                        _ => Align::Left,
                    };
                    i += 3;
                } // ESC a n  align
                0x45 => {
                    bold = at(i + 2) != 0;
                    i += 3;
                } // ESC E n  bold
                0x21 => {
                    bold = at(i + 2) & 0x08 != 0;
                    i += 3;
                } // ESC ! n  print mode
                0x64 => {
                    for _ in 0..at(i + 2) {
                        lines.push(Line { text: String::new(), align, bold });
                    }
                    i += 3;
                } // ESC d n  feed
                0x70 => {
                    drawer = true;
                    i += 5;
                } // ESC p m t1 t2  drawer kick
                0x2d => i += 3, // ESC - n  underline
                _ => i += 2,
            },
            0x1d => match at(i + 1) {
                0x56 => {
                    cut = true;
                    let m = at(i + 2);
                    i += if m == 65 || m == 66 { 4 } else { 3 };
                } // GS V  cut
                0x21 | 0x42 => i += 3, // GS ! / GS B
                0x4c | 0x57 => i += 4, // GS L / GS W
                _ => i += 2,
            },
            0x0a => {
                lines.push(Line { text: std::mem::take(&mut cur), align, bold });
                i += 1;
            } // LF
            0x0d => i += 1, // CR
            b if b >= 0x20 => {
                cur.push(b as char); // receipts are ASCII/Latin
                i += 1;
            }
            _ => i += 1,
        }
    }
    if !cur.is_empty() {
        lines.push(Line { text: cur, align, bold });
    }
    Receipt { lines, cut, drawer }
}

/// Render ESC/POS bytes to PNG bytes (in-process / for serving over HTTP).
pub fn render_png(bytes: &[u8], width_chars: u32) -> Result<Vec<u8>, ImageError> {
    let img = render_image(bytes, width_chars);
    let mut buf = Vec::new();
    img.write_to(&mut std::io::Cursor::new(&mut buf), ImageFormat::Png)?;
    Ok(buf)
}

/// Render ESC/POS bytes to a PNG file. `width_chars` is 48 (80mm) or 32 (58mm).
pub fn render_png_to(bytes: &[u8], path: &Path, width_chars: u32) -> Result<(), ImageError> {
    render_image(bytes, width_chars).save_with_format(path, ImageFormat::Png)
}

/// Build the receipt image (shared by `render_png` / `render_png_to`).
fn render_image(bytes: &[u8], width_chars: u32) -> RgbaImage {
    let scale: u32 = 3; // 8x8 glyph -> 24px, readable
    let cell = 8 * scale;
    let pad = cell;
    let line_h = cell + 2 * scale;

    let r = parse(bytes);
    let mut rows = r.lines;
    if r.drawer {
        rows.insert(0, Line { text: "[cash drawer kick]".into(), align: Align::Center, bold: true });
    }
    if r.cut {
        rows.push(Line { text: "-".repeat(width_chars as usize), align: Align::Left, bold: false });
        rows.push(Line { text: ">8 ----- cut -----".into(), align: Align::Center, bold: false });
    }

    let area = width_chars * cell;
    let w = area + pad * 2;
    let h = (rows.len().max(1) as u32) * line_h + pad * 2;
    let mut img = RgbaImage::from_pixel(w, h, Rgba([255, 255, 255, 255]));

    let mut y = pad;
    for line in &rows {
        let text_w = line.text.chars().count() as u32 * cell;
        let x0 = pad
            + match line.align {
                Align::Left => 0,
                Align::Center => area.saturating_sub(text_w) / 2,
                Align::Right => area.saturating_sub(text_w),
            };
        draw_text(&mut img, &line.text, x0, y, scale, line.bold);
        y += line_h;
    }
    img
}

fn draw_text(img: &mut RgbaImage, text: &str, x0: u32, y0: u32, scale: u32, bold: bool) {
    let mut x = x0;
    for ch in text.chars() {
        let code = ch as usize;
        if code < 128 {
            draw_glyph(img, &BASIC_LEGACY[code], x, y0, scale, bold);
        }
        x += 8 * scale;
    }
}

fn draw_glyph(img: &mut RgbaImage, glyph: &[u8; 8], x0: u32, y0: u32, scale: u32, bold: bool) {
    let black = Rgba([17, 17, 17, 255]);
    for (row, bits) in glyph.iter().enumerate() {
        for col in 0..8u32 {
            if bits >> col & 1 == 1 {
                for dy in 0..scale {
                    for dx in 0..scale {
                        put(img, x0 + col * scale + dx, y0 + row as u32 * scale + dy, black);
                        if bold {
                            put(img, x0 + col * scale + dx + 1, y0 + row as u32 * scale + dy, black);
                        }
                    }
                }
            }
        }
    }
}

#[inline]
fn put(img: &mut RgbaImage, x: u32, y: u32, px: Rgba<u8>) {
    if x < img.width() && y < img.height() {
        img.put_pixel(x, y, px);
    }
}
