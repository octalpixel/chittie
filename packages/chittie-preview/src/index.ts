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

// ESC/POS Font B is ~9×17 vs Font A 12×24 — roughly 0.72× on screen.
const FONT_B_SCALE = 0.72;

type Op =
  | { k: 'ch'; x: number; y: number; c: string; bold: boolean; scale: number; fontB: boolean }
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
  let fontB = false;
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
      else if (c === 0x4d) { fontB = bytes[i + 2] === 1; i += 3; } // ESC M n — font (0=A, 1=B)
      else if (c === 0x74 || c === 0x52 || c === 0x20 || c === 0x2d || c === 0x7b || c === 0x47) i += 3; // 1-param
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
      if (ch && ch !== ' ') ops.push({ k: 'ch', x, y, c: ch, bold, scale: hScale, fontB });
      if (hScale > lineMaxScale) lineMaxScale = hScale;
      x += cfg.cellWidth * wScale * (fontB ? FONT_B_SCALE : 1);
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
      ctx.font = `${op.bold ? 'bold ' : ''}${(op.fontB ? 18 * FONT_B_SCALE : 18) * op.scale}px ${fontFamily}`;
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

// ---------------------------------------------------------------------------
// Label preview — render the TSPL bytes chittie-label emits to a canvas.
// ---------------------------------------------------------------------------

export interface LabelPreviewOptions {
  createCanvas: (width: number, height: number) => PreviewCanvas;
  /** Printer resolution; sets the dot grid. 203 → 8 dots/mm, 300 → 12. Default 203. */
  dpi?: 203 | 300;
  /** Font family for TEXT (default 'sans-serif'). */
  fontFamily?: string;
  /** Fallback canvas size (dots) when the stream has no SIZE. Default 320×240. */
  fallback?: { width: number; height: number };
}

type LOp =
  | { k: 'text'; x: number; y: number; px: number; content: string }
  | { k: 'box'; x: number; y: number; w: number; h: number; t: number }
  | { k: 'bar'; x: number; y: number; w: number; h: number }
  | { k: 'barcode'; x: number; y: number; h: number; human: number; data: string }
  | { k: 'qr'; x: number; y: number; cell: number; data: string }
  | { k: 'img'; x: number; y: number; blacks: Array<[number, number]> };

const FONT_PX: Record<string, number> = { '1': 12, '2': 16, '3': 20, '4': 28, '5': 40 };

function parseLabel(bytes: Uint8Array, dpi: number, fallback: { width: number; height: number }) {
  const n = bytes.length;
  const at = (i: number) => bytes[i] ?? 0;
  const sub = (a: number, b: number) => Array.from(bytes.subarray(a, b), (c) => String.fromCharCode(c)).join('');
  const dotsPerMm = dpi / 25.4;
  let width = fallback.width;
  let height = fallback.height;
  const ops: LOp[] = [];
  let i = 0;
  while (i < n) {
    if (at(i) === 0x0d || at(i) === 0x0a) {
      i++;
      continue;
    }
    // keyword = leading A–Z run
    let k = i;
    while (k < n && at(k) >= 0x41 && at(k) <= 0x5a) k++;
    const word = sub(i, k);
    if (word === 'BITMAP') {
      // BITMAP x,y,wBytes,h,mode,<binary>
      let j = k;
      const nums: number[] = [];
      let cur = '';
      while (nums.length < 5 && j < n) {
        const c = at(j);
        if (c >= 0x30 && c <= 0x39) cur += String.fromCharCode(c);
        else if (c === 0x2c) {
          nums.push(Number(cur));
          cur = '';
        }
        j++;
      }
      const [x = 0, y = 0, wBytes = 0, h = 0] = nums;
      const start = j;
      const blacks: Array<[number, number]> = [];
      for (let row = 0; row < h; row++)
        for (let col = 0; col < wBytes * 8; col++) {
          const byte = at(start + row * wBytes + (col >> 3));
          if (!((byte >> (7 - (col & 7))) & 1)) blacks.push([col, row]); // bit 0 = black
        }
      ops.push({ k: 'img', x, y, blacks });
      i = start + wBytes * h;
      continue;
    }
    // text command: read to end of line
    let e = i;
    while (e < n && at(e) !== 0x0a && at(e) !== 0x0d) e++;
    const line = sub(i, e);
    i = e + 1;
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^SIZE ([\d.]+) mm,([\d.]+) mm/))) {
      width = Math.round(Number(m[1]) * dotsPerMm);
      height = Math.round(Number(m[2]) * dotsPerMm);
    } else if ((m = line.match(/^TEXT (\d+),(\d+),"([^"]*)",(\d+),(\d+),(\d+),"(.*)"$/))) {
      const px = (FONT_PX[m[3]!] ?? 20) * Number(m[6]);
      ops.push({ k: 'text', x: +m[1]!, y: +m[2]!, px, content: m[7]! });
    } else if ((m = line.match(/^BARCODE (\d+),(\d+),"[^"]*",(\d+),(\d+),\d+,\d+,\d+,"(.*)"$/))) {
      ops.push({ k: 'barcode', x: +m[1]!, y: +m[2]!, h: +m[3]!, human: +m[4]!, data: m[5]! });
    } else if ((m = line.match(/^QRCODE (\d+),(\d+),[LMQH],(\d+),\w,\d+,"(.*)"$/))) {
      ops.push({ k: 'qr', x: +m[1]!, y: +m[2]!, cell: +m[3]!, data: m[4]! });
    } else if ((m = line.match(/^BOX (\d+),(\d+),(\d+),(\d+),(\d+)/))) {
      ops.push({ k: 'box', x: +m[1]!, y: +m[2]!, w: +m[3]! - +m[1]!, h: +m[4]! - +m[2]!, t: +m[5]! });
    } else if ((m = line.match(/^BAR (\d+),(\d+),(\d+),(\d+)/))) {
      ops.push({ k: 'bar', x: +m[1]!, y: +m[2]!, w: +m[3]!, h: +m[4]! });
    }
  }
  return { ops, width, height };
}

/** Render TSPL bytes (from chittie-label `encode()` / chittie-label-react `render()`) to a canvas. */
export function renderLabel(bytes: Uint8Array, options: LabelPreviewOptions): PreviewCanvas {
  const dpi = options.dpi ?? 203;
  const fontFamily = options.fontFamily ?? 'sans-serif';
  const fallback = options.fallback ?? { width: 320, height: 240 };
  const { ops, width, height } = parseLabel(bytes, dpi, fallback);

  const canvas = options.createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('chittie-preview: createCanvas returned no 2d context');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000';

  for (const op of ops) {
    if (op.k === 'text') {
      ctx.fillStyle = '#000';
      ctx.font = `${op.px}px ${fontFamily}`;
      ctx.fillText(op.content, op.x, op.y);
    } else if (op.k === 'bar') {
      ctx.fillStyle = '#000';
      ctx.fillRect(op.x, op.y, op.w, op.h);
    } else if (op.k === 'box') {
      ctx.fillStyle = '#000';
      const t = Math.max(1, op.t);
      ctx.fillRect(op.x, op.y, op.w, t); // top
      ctx.fillRect(op.x, op.y + op.h - t, op.w, t); // bottom
      ctx.fillRect(op.x, op.y, t, op.h); // left
      ctx.fillRect(op.x + op.w - t, op.y, t, op.h); // right
    } else if (op.k === 'img') {
      ctx.fillStyle = '#000';
      for (const [px, py] of op.blacks) ctx.fillRect(op.x + px, op.y + py, 1, 1);
    } else if (op.k === 'barcode') {
      // representative bars (preview, not scan-accurate) + human-readable text
      ctx.fillStyle = '#000';
      let bx = op.x;
      for (let c = 0; c < op.data.length * 3 && bx < op.x + op.data.length * 12; c++) {
        const w = ((op.data.charCodeAt(c % op.data.length) >> (c % 4)) & 1) + 1;
        if (c % 2 === 0) ctx.fillRect(bx, op.y, w, op.h);
        bx += w + 1;
      }
      if (op.human) {
        ctx.font = `16px ${fontFamily}`;
        ctx.fillText(op.data, op.x, op.y + op.h + 2);
      }
    } else {
      // QR placeholder: finder squares + deterministic module grid
      ctx.fillStyle = '#000';
      const modules = 21;
      const c = op.cell;
      for (let r = 0; r < modules; r++)
        for (let q = 0; q < modules; q++) {
          const finder = (r < 7 && q < 7) || (r < 7 && q >= modules - 7) || (r >= modules - 7 && q < 7);
          const on = finder
            ? r === 0 || r === 6 || q === 0 || q === 6 || (r >= 2 && r <= 4 && q >= 2 && q <= 4)
            : ((op.data.charCodeAt((r * modules + q) % op.data.length) >> (q % 7)) & 1) === 1;
          if (on) ctx.fillRect(op.x + q * c, op.y + r * c, c, c);
        }
    }
  }
  return canvas;
}
