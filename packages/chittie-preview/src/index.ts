// Render a receipt to an image by parsing the ESC/POS bytes chittie emits — a
// software preview of "what the printer will actually print". Platform-neutral:
// you inject a canvas factory (browser HTMLCanvasElement or @napi-rs/canvas).

/** The 2D context methods/properties chittie-preview draws with. */
export interface PreviewContext2D {
  fillStyle: string;
  strokeStyle: string;
  font: string;
  textBaseline: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  setLineDash(segments: number[]): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
}

export interface PreviewCanvas {
  width: number;
  height: number;
  getContext(type: '2d'): PreviewContext2D | null;
}

export interface PreviewOptions {
  /** Canvas factory. Web: `(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h})`. Node: `@napi-rs/canvas` `createCanvas`. */
  createCanvas: (width: number, height: number) => PreviewCanvas;
  /** Characters per line (default 32). */
  columns?: number;
  /** Pixels per character cell (default 12). */
  cellWidth?: number;
  /** Pixels per text line (default 26). */
  lineHeight?: number;
  /** Font family for text (default 'monospace'). */
  fontFamily?: string;
  /** Outer padding in px (default 16). */
  padding?: number;
}

// cp437 upper half (0x80–0xFF) — receipts use box-drawing (─ │) for rules, etc.
const CP437_HIGH =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
const decode = (b: number): string => (b < 0x80 ? String.fromCharCode(b) : (CP437_HIGH[b - 0x80] ?? ''));

type Op =
  | { k: 'ch'; x: number; y: number; c: string; bold: boolean; scale: number }
  | { k: 'img'; blacks: Array<[number, number]> }
  | { k: 'cut'; y: number }
  | { k: 'box'; x: number; y: number; w: number; h: number; label: string };

interface Cfg {
  columns: number;
  cellWidth: number;
  lineHeight: number;
  padding: number;
}

function parse(bytes: Uint8Array, cfg: Cfg): { ops: Op[]; height: number } {
  const dots = cfg.columns * cfg.cellWidth;
  const u16 = (lo: number, hi: number) => lo + hi * 256;
  const ops: Op[] = [];
  let x = 0;
  let y = cfg.padding;
  let bold = false;
  let wScale = 1;
  let hScale = 1;
  let lineMaxScale = 1;
  let align: 'left' | 'center' | 'right' = 'left';
  let suppressNextLF = false;
  let i = 0;
  const n = bytes.length;
  const imgX = (w: number) =>
    align === 'center' ? Math.max(0, Math.round((dots - w) / 2)) : align === 'right' ? Math.max(0, dots - w) : 0;

  while (i < n) {
    const b = bytes[i]!;
    if (b === 0x1b) {
      const c = bytes[i + 1];
      if (c === 0x40) i += 2; // ESC @ init
      else if (c === 0x45) { bold = !!bytes[i + 2]; i += 3; } // ESC E bold
      else if (c === 0x21) { const m = bytes[i + 2]!; bold = !!(m & 0x08); wScale = m & 0x20 ? 2 : 1; hScale = m & 0x10 ? 2 : 1; i += 3; } // ESC ! mode
      else if (c === 0x61) { const m = bytes[i + 2]; align = m === 1 ? 'center' : m === 2 ? 'right' : 'left'; i += 3; } // ESC a align
      else if (c === 0x4a) { y += bytes[i + 2] ?? 0; i += 3; } // ESC J feed dots
      else if (c === 0x64) { y += (bytes[i + 2] ?? 0) * cfg.lineHeight; i += 3; } // ESC d feed lines
      else if (c === 0x70) i += 5; // ESC p pulse
      else if (c === 0x32) i += 2; // ESC 2 (line spacing — handled via bands)
      else if (c === 0x2a) { // ESC * column-mode image
        const m = bytes[i + 2]!;
        const cols = u16(bytes[i + 3]!, bytes[i + 4]!);
        const bpc = m === 0 || m === 1 ? 1 : 3;
        const start = i + 5;
        const data = bytes.subarray(start, start + bpc * cols);
        const ix = imgX(cols);
        const blacks: Array<[number, number]> = [];
        for (let col = 0; col < cols; col++) {
          for (let byte = 0; byte < bpc; byte++) {
            const v = data[col * bpc + byte] ?? 0;
            for (let bit = 0; bit < 8; bit++) if (v & (0x80 >> bit)) blacks.push([ix + col, y + byte * 8 + bit]);
          }
        }
        ops.push({ k: 'img', blacks });
        y += bpc * 8;
        suppressNextLF = true; // the band's trailing LF must not double-advance
        i = start + bpc * cols;
      } else if (c === 0x33) i += 3; // ESC 3 n
      else if (c === 0x74 || c === 0x4d || c === 0x52 || c === 0x20 || c === 0x2d || c === 0x7b || c === 0x47) i += 3; // 1-param
      else i += 2; // unknown ESC
    } else if (b === 0x1d) {
      const c = bytes[i + 1];
      if (c === 0x21) { const m = bytes[i + 2]!; wScale = ((m >> 4) & 7) + 1; hScale = (m & 7) + 1; i += 3; } // GS ! size
      else if (c === 0x56) { ops.push({ k: 'cut', y }); y += 14; i += (bytes[i + 2] ?? 0) >= 65 ? 4 : 3; } // GS V cut
      else if (c === 0x76 && bytes[i + 2] === 0x30) { // GS v 0 raster
        const wbytes = u16(bytes[i + 4]!, bytes[i + 5]!);
        const h = u16(bytes[i + 6]!, bytes[i + 7]!);
        const start = i + 8;
        const w = wbytes * 8;
        const data = bytes.subarray(start, start + wbytes * h);
        const ix = imgX(w);
        const blacks: Array<[number, number]> = [];
        for (let row = 0; row < h; row++)
          for (let col = 0; col < w; col++) if (data[row * wbytes + (col >> 3)]! & (0x80 >> (col & 7))) blacks.push([ix + col, y + row]);
        ops.push({ k: 'img', blacks });
        y += h + 4;
        i = start + wbytes * h;
      } else if (c === 0x6b) { // GS k barcode
        const m = bytes[i + 2]!;
        let j: number;
        if (m >= 65) j = i + 4 + (bytes[i + 3] ?? 0);
        else { j = i + 3; while (j < n && bytes[j] !== 0x00) j++; j++; }
        const w = Math.min(dots, 220);
        ops.push({ k: 'box', x: imgX(w), y, w, h: 54, label: 'barcode' });
        y += 60;
        i = j;
      } else if (c === 0x28 && bytes[i + 2] === 0x6b) { // GS ( k  2D (QR)
        const dlen = u16(bytes[i + 3]!, bytes[i + 4]!);
        if (bytes[i + 5] === 0x31 && bytes[i + 6] === 0x50) { // store-data fn → placeholder
          ops.push({ k: 'box', x: imgX(96), y, w: 96, h: 96, label: 'QR' });
          y += 102;
        }
        i = i + 5 + dlen;
      } else if (c === 0x68 || c === 0x77 || c === 0x48 || c === 0x66 || c === 0x42 || c === 0x45) i += 3; // GS h/w/H/f/B/E 1-param
      else i += 3; // unknown GS
    } else if (b === 0x1c) {
      i += bytes[i + 1] === 0x2e || bytes[i + 1] === 0x26 ? 2 : 3; // FS
    } else if (b === 0x0a) {
      if (suppressNextLF) suppressNextLF = false;
      else { y += cfg.lineHeight * lineMaxScale; lineMaxScale = 1; }
      x = 0;
      i += 1;
    } else if (b === 0x0d) {
      i += 1;
    } else {
      const ch = decode(b);
      if (ch && ch !== ' ') ops.push({ k: 'ch', x, y, c: ch, bold, scale: hScale });
      if (hScale > lineMaxScale) lineMaxScale = hScale;
      x += cfg.cellWidth * wScale;
      i += 1;
    }
  }
  return { ops, height: y + cfg.padding };
}

/** Render ESC/POS bytes (from chittie `render()` / `encode()`) to a canvas. */
export function renderReceipt(bytes: Uint8Array, options: PreviewOptions): PreviewCanvas {
  const cfg: Cfg = {
    columns: options.columns ?? 32,
    cellWidth: options.cellWidth ?? 12,
    lineHeight: options.lineHeight ?? 26,
    padding: options.padding ?? 16,
  };
  const fontFamily = options.fontFamily ?? 'monospace';
  const dots = cfg.columns * cfg.cellWidth;
  const { ops, height } = parse(bytes, cfg);

  const canvas = options.createCanvas(dots + cfg.padding * 2, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('chittie-preview: createCanvas returned no 2d context');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'top';

  for (const op of ops) {
    if (op.k === 'ch') {
      ctx.fillStyle = '#000';
      ctx.font = `${op.bold ? 'bold ' : ''}${18 * op.scale}px ${fontFamily}`;
      ctx.fillText(op.c, cfg.padding + op.x, op.y);
    } else if (op.k === 'img') {
      ctx.fillStyle = '#000';
      for (const [px, py] of op.blacks) ctx.fillRect(cfg.padding + px, py, 1, 1);
    } else if (op.k === 'cut') {
      ctx.strokeStyle = '#999';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cfg.padding, op.y);
      ctx.lineTo(cfg.padding + dots, op.y);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = '#000';
      ctx.setLineDash([]);
      ctx.strokeRect(cfg.padding + op.x, op.y, op.w, op.h);
      ctx.fillStyle = '#666';
      ctx.font = `12px ${fontFamily}`;
      ctx.fillText(op.label, cfg.padding + op.x + 6, op.y + op.h / 2 - 6);
    }
  }
  return canvas;
}
