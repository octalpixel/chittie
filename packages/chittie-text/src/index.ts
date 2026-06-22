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
