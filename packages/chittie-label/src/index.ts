import CodepageEncoder from '@angadie/chittie-codepage';
import { needsRaster, foldTypographic, sanitizeControl, type TextRasterizer, type RasterOptions } from '@angadie/chittie-text';

export type Codepage = Parameters<typeof CodepageEncoder.encode>[1];

/** Label stock + printer setup. Sizes are in millimetres; element coordinates are in dots. */
export interface LabelProfile {
  /** Label width in mm. */
  widthMm: number;
  /** Label height in mm. */
  heightMm: number;
  /** Gap between labels in mm (0 = continuous stock). Default 2. */
  gapMm?: number;
  /** Printer resolution. 203 DPI = 8 dots/mm, 300 DPI = 12 dots/mm. Default 203. */
  dpi?: 203 | 300;
  /** Print speed (inches/sec); printer default if omitted. */
  speed?: number;
  /** Darkness 0–15; printer default if omitted. */
  density?: number;
  /** Print direction 0 | 1 (feed orientation). Default 1. */
  direction?: 0 | 1;
  /** Printer code page for TEXT content (default cp437). */
  codepage?: Codepage;
  /** Origin offset [x,y] in dots. */
  reference?: [number, number];
}

/** Friendly 1D barcode names → TSPL `code type` strings. */
const BARCODE_TYPES = {
  code128: '128',
  code128m: '128M',
  ean128: 'EAN128',
  code39: '39',
  code93: '93',
  ean13: 'EAN13',
  ean8: 'EAN8',
  upca: 'UPCA',
  upce: 'UPCE',
  codabar: 'CODA',
  itf14: 'ITF14',
  interleaved25: '25',
  msi: 'MSI',
} as const;
export type BarcodeType = keyof typeof BARCODE_TYPES;

export interface TextOptions {
  /** Internal bitmap font "1"–"5" (or "0"/TrueType on TSPL2). Default "3". */
  font?: string;
  /** Rotation: 0 | 90 | 180 | 270. Default 0. */
  rotation?: 0 | 90 | 180 | 270;
  /** Horizontal magnification 1–10. Default 1. */
  xMul?: number;
  /** Vertical magnification 1–10. Default 1. */
  yMul?: number;
  /** Font size (px) used only when the text must be rasterized (non-Latin). Default 28. */
  rasterFontSize?: number;
}

export interface BarcodeOptions {
  type?: BarcodeType;
  /** Bar height in dots. Default 50. */
  height?: number;
  /** Human-readable text: 0 none | 1 below | 2 above. Default 1. */
  human?: 0 | 1 | 2;
  rotation?: 0 | 90 | 180 | 270;
  /** Narrow bar width in dots. Default 2. */
  narrow?: number;
  /** Wide bar width in dots. Default 4. */
  wide?: number;
}

export interface QrOptions {
  /** Error correction: 'L' | 'M' | 'Q' | 'H'. Default 'M'. */
  ecc?: 'L' | 'M' | 'Q' | 'H';
  /** Cell (dot) size 1–10. Default 5. */
  cell?: number;
  rotation?: 0 | 90 | 180 | 270;
}

export interface ImageOptions {
  /** 0 OVERWRITE | 1 OR | 2 XOR. Default 0. */
  mode?: 0 | 1 | 2;
  /** Luma threshold (0–255) below which a pixel prints (black). Default 128. */
  threshold?: number;
}

export interface LabelOptions {
  /** Supply to print non-Latin text (Sinhala/Tamil/…) as a rasterized image. */
  rasterizer?: TextRasterizer;
}

// ASCII byte encode for the command structure (digits, punctuation, keywords) — RN-safe, no Buffer.
const ascii = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
// Encode TEXT content through the chosen code page (matches the printer's CODEPAGE).
const content = (s: string, cp: Codepage): Uint8Array => CodepageEncoder.encode(s, cp);
// TSPL data sits inside quotes — drop quotes/controls so it can't break the command.
const quoteSafe = (s: string): string => sanitizeControl(s).replace(/"/g, "'");

function concat(chunks: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const c of chunks) n += c.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** dots = mm × (dpi / 25.4). 203 DPI → 8 dots/mm, 300 DPI → ~12. */
export function mmToDots(mm: number, dpi: 203 | 300 = 203): number {
  return Math.round((mm * dpi) / 25.4);
}

/**
 * Pack an ImageData to a TSPL BITMAP payload. MSB-first; a dark pixel is bit 0
 * (printed), a light pixel is bit 1 (TSPL convention — verified against
 * raster-to-tspl-js). Width is rounded up to whole bytes.
 */
export function packBitmap(img: ImageData, threshold = 128): { widthBytes: number; height: number; bytes: Uint8Array } {
  const { width: w, height: h, data } = img;
  const widthBytes = (w + 7) >> 3;
  const bytes = new Uint8Array(widthBytes * h).fill(0xff); // default white (1 bits)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const alpha = data[i + 3] ?? 255;
      const luma = 0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0);
      const dark = alpha >= 128 && luma < threshold;
      if (dark) {
        const bi = y * widthBytes + (x >> 3);
        bytes[bi] = (bytes[bi] ?? 0xff) & ~(1 << (7 - (x & 7))); // clear bit → black/printed
      }
    }
  }
  return { widthBytes, height: h, bytes };
}

export interface LabelBuilder {
  /** Convert millimetres to dots for this profile's DPI. */
  mm(value: number): number;
  /** Positioned text. Non-Latin content is rasterized (needs `rasterizer`) or throws. */
  text(x: number, y: number, value: string | number, options?: TextOptions): LabelBuilder;
  /** Positioned 1D barcode. */
  barcode(x: number, y: number, data: string | number, options?: BarcodeOptions): LabelBuilder;
  /** Positioned QR code. */
  qrcode(x: number, y: number, data: string, options?: QrOptions): LabelBuilder;
  /** Outline rectangle from (x,y), `w`×`h` dots, with line `thickness` (default 2). */
  box(x: number, y: number, w: number, h: number, thickness?: number): LabelBuilder;
  /** Filled bar/line `w`×`h` dots from (x,y). */
  bar(x: number, y: number, w: number, h: number): LabelBuilder;
  /** Positioned 1-bit raster image (logos, or any ImageData). */
  image(x: number, y: number, img: ImageData, options?: ImageOptions): LabelBuilder;
  /** Escape hatch — append a raw TSPL command line (no trailing newline needed). */
  raw(line: string): LabelBuilder;
  /** Emit the full TSPL job: setup + CLS + commands + PRINT. */
  encode(print?: { sets?: number; copies?: number }): Uint8Array;
}

const CRLF = '\r\n';

/** Create a TSPL label builder for the given stock/printer profile. */
export function label(profile: LabelProfile, options: LabelOptions = {}): LabelBuilder {
  const dpi = profile.dpi ?? 203;
  const cp = profile.codepage ?? 'cp437';
  const body: Uint8Array[] = [];
  const line = (s: string) => body.push(ascii(s + CRLF));

  const builder: LabelBuilder = {
    mm: (value) => mmToDots(value, dpi),

    text(x, y, value, opts = {}) {
      const { font = '3', rotation = 0, xMul = 1, yMul = 1, rasterFontSize = 28 } = opts;
      const text = quoteSafe(foldTypographic(String(value)));
      if (needsRaster(text, cp)) {
        if (!options.rasterizer) {
          throw new Error(
            `chittie-label: "${text}" has no code page (e.g. Sinhala/Tamil). Pass a rasterizer to label(profile, { rasterizer }) to print it as an image.`
          );
        }
        const img = options.rasterizer.rasterize(text, { fontSize: rasterFontSize } as RasterOptions);
        return builder.image(x, y, img);
      }
      body.push(ascii(`TEXT ${x},${y},"${font}",${rotation},${xMul},${yMul},"`));
      body.push(content(text, cp));
      body.push(ascii(`"${CRLF}`));
      return builder;
    },

    barcode(x, y, data, opts = {}) {
      const { type = 'code128', height = 50, human = 1, rotation = 0, narrow = 2, wide = 4 } = opts;
      const code = BARCODE_TYPES[type];
      line(`BARCODE ${x},${y},"${code}",${height},${human},${rotation},${narrow},${wide},"${quoteSafe(String(data))}"`);
      return builder;
    },

    qrcode(x, y, data, opts = {}) {
      const { ecc = 'M', cell = 5, rotation = 0 } = opts;
      line(`QRCODE ${x},${y},${ecc},${cell},A,${rotation},"${quoteSafe(data)}"`);
      return builder;
    },

    box(x, y, w, h, thickness = 2) {
      line(`BOX ${x},${y},${x + w},${y + h},${thickness}`);
      return builder;
    },

    bar(x, y, w, h) {
      line(`BAR ${x},${y},${w},${h}`);
      return builder;
    },

    image(x, y, img, opts = {}) {
      const { mode = 0, threshold = 128 } = opts;
      const { widthBytes, height, bytes } = packBitmap(img, threshold);
      body.push(ascii(`BITMAP ${x},${y},${widthBytes},${height},${mode},`));
      body.push(bytes);
      body.push(ascii(CRLF));
      return builder;
    },

    raw(l) {
      line(l);
      return builder;
    },

    encode(print = {}) {
      const { sets = 1, copies = 1 } = print;
      const head: Uint8Array[] = [];
      const h = (s: string) => head.push(ascii(s + CRLF));
      h(`SIZE ${profile.widthMm} mm,${profile.heightMm} mm`);
      h(`GAP ${profile.gapMm ?? 2} mm,0 mm`);
      h(`DIRECTION ${profile.direction ?? 1}`);
      if (profile.reference) h(`REFERENCE ${profile.reference[0]},${profile.reference[1]}`);
      if (profile.speed != null) h(`SPEED ${profile.speed}`);
      if (profile.density != null) h(`DENSITY ${profile.density}`);
      if (profile.codepage) h(`CODEPAGE ${profile.codepage}`);
      h('CLS');
      const tail = ascii(`PRINT ${sets},${copies}${CRLF}`);
      return concat([...head, ...body, tail]);
    },
  };
  return builder;
}

/** Common label-stock presets (mm). Pair with `dpi`/`gapMm` overrides as needed. */
export const LABEL_PROFILES = {
  '40x30': { widthMm: 40, heightMm: 30 },
  '50x30': { widthMm: 50, heightMm: 30 },
  '30x20': { widthMm: 30, heightMm: 20 },
  '50x25': { widthMm: 50, heightMm: 25 },
  '60x40': { widthMm: 60, heightMm: 40 },
} as const satisfies Record<string, Pick<LabelProfile, 'widthMm' | 'heightMm'>>;
