import CodepageEncoder from '@angadie/chittie-codepage';

/** Code-page name accepted by the encoder — derived from the engine, not duplicated. */
export type Codepage = Parameters<typeof CodepageEncoder.encode>[1];

/**
 * True if `text` contains characters the target code page cannot represent
 * (they would print as "?"). Sinhala, Tamil, and other Indic/complex scripts
 * have no thermal-printer code page, so they always return true — those runs
 * must be printed as a raster image (see VENDOR research: non-latin-printing).
 */
export function needsRaster(text: string, codepage: Codepage = 'cp437'): boolean {
  for (const ch of text) {
    if (ch === '?') continue;
    const bytes = CodepageEncoder.encode(ch, codepage);
    if (bytes.length > 0 && Array.from(bytes).every((b) => b === 0x3f)) return true;
  }
  return false;
}

/** Options handed to the injected rasterizer. */
export interface RasterOptions {
  fontSize?: number;
  bold?: boolean;
  font?: string;
  /** Max pixel width (printer dot width, e.g. 384 for 58mm, 576 for 80mm). */
  maxWidth?: number;
}

/**
 * You implement this with a platform rasterizer (web canvas, react-native-skia,
 * or a pre-rendered PNG decoded to ImageData). chittie-text stays platform-neutral
 * and dependency-free; it never imports canvas/skia.
 */
export interface TextRasterizer {
  rasterize(text: string, options: RasterOptions): ImageData;
}

/** Minimal slice of the encoder smartText drives (avoids depending on chittie-core). */
interface EncoderLike {
  text(value: string): unknown;
  image(image: ImageData, width: number, height: number): unknown;
}

/**
 * ESC/POS raster requires dimensions that are multiples of 8. Pad right/bottom
 * with white so any image "just works". Platform-neutral: reuses the input's own
 * ImageData constructor (browser or @canvas/image-data) — no import. Exported so
 * chittie-react's <Image> (and others) reuse the same handling.
 */
export function padTo8(img: ImageData): ImageData {
  const { width: w, height: h } = img;
  const w8 = Math.ceil(w / 8) * 8;
  const h8 = Math.ceil(h / 8) * 8;
  if (w8 === w && h8 === h) return img;
  const out = new Uint8ClampedArray(w8 * h8 * 4).fill(255); // white padding
  for (let y = 0; y < h; y++) {
    out.set(img.data.subarray(y * w * 4, y * w * 4 + w * 4), y * w8 * 4);
  }
  const Ctor = img.constructor as new (data: Uint8ClampedArray, width: number, height: number) => ImageData;
  return new Ctor(out, w8, h8);
}

export interface SmartTextOptions {
  rasterizer?: TextRasterizer;
  codepage?: Codepage;
  raster?: RasterOptions;
}

/**
 * Print `text` the right way: as code-page text when it's representable, or as a
 * rasterized image when it isn't (Sinhala/Tamil/…). If a raster is needed but no
 * rasterizer was supplied, it throws a clear error instead of silently printing "?".
 */
export function smartText(encoder: EncoderLike, text: string, options: SmartTextOptions = {}): void {
  const codepage = options.codepage ?? 'cp437';
  if (!needsRaster(text, codepage)) {
    encoder.text(text);
    return;
  }
  if (!options.rasterizer) {
    throw new Error(
      `chittie-text: "${text}" contains characters with no code page (e.g. Sinhala/Tamil). ` +
        'Provide a rasterizer to print it as an image, or remove the unsupported characters. ' +
        'See https://github.com/octalpixel/chittie — non-Latin scripts must be rastered.'
    );
  }
  const img = padTo8(options.rasterizer.rasterize(text, options.raster ?? {}));
  encoder.image(img, img.width, img.height);
}

// --- row rasterization (for non-Latin in table cells) ---

function blank(template: ImageData, width: number, height: number): ImageData {
  const Ctor = template.constructor as new (data: Uint8ClampedArray, w: number, h: number) => ImageData;
  return new Ctor(new Uint8ClampedArray(width * height * 4).fill(255), width, height);
}

function blit(dst: ImageData, src: ImageData, dx: number, dy: number): void {
  for (let y = 0; y < src.height; y++) {
    const drow = ((dy + y) * dst.width + dx) * 4;
    dst.data.set(src.data.subarray(y * src.width * 4, (y + 1) * src.width * 4), drow);
  }
}

/**
 * Render a two-column row (left flush-left, right flush-right) to one
 * printer-width image — the correct way to print non-Latin text inside a
 * table column, since a per-cell image can't sit in a text column. chittie
 * computes the layout; the injected rasterizer shapes each fragment.
 */
export function rasterizeRow(
  rasterizer: TextRasterizer,
  left: string,
  right: string,
  options: { dotWidth: number } & RasterOptions
): ImageData {
  const { dotWidth, ...raster } = options;
  const l = left ? rasterizer.rasterize(left, raster) : undefined;
  const r = right ? rasterizer.rasterize(right, raster) : undefined;
  const template = l ?? r;
  if (!template) return padTo8(blankImage(8, 8));
  const height = Math.max(l?.height ?? 0, r?.height ?? 0) || 1;
  const width = Math.max(dotWidth, (l?.width ?? 0) + (r?.width ?? 0));
  const out = blank(template, width, height);
  if (l) blit(out, l, 0, 0);
  if (r) blit(out, r, width - r.width, 0);
  return padTo8(out);
}

function blankImage(w: number, h: number): ImageData {
  // Fallback when there's nothing to render — needs a global ImageData.
  const Ctor = (globalThis as { ImageData?: new (d: Uint8ClampedArray, w: number, h: number) => ImageData }).ImageData;
  if (!Ctor) throw new Error('chittie-text: no ImageData available for an empty row');
  return new Ctor(new Uint8ClampedArray(w * h * 4).fill(255), w, h);
}
