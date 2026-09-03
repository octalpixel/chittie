import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import type { BarcodeSymbology, DitherAlgorithm } from '@angadie/chittie-core';
import { smartText, padTo8, needsRaster, rasterizeRow, rasterizeColumns, foldTypographic, sanitizeControl, dotsPerMm } from '@angadie/chittie-text';

const clean = (s: string) => foldTypographic(sanitizeControl(s));
// Base rasterized line height ≈ 3mm; scaled by the printer DPI so non-Latin text
// is the same physical size on 58/80mm and 203/300-DPI (1 raster px = 1 dot).
const BASE_MM = 3;
const rasterPx = (dpi: number, scale = 1) => Math.round(BASE_MM * dotsPerMm(dpi) * scale);
import type { Encoder, Printable, RenderContext } from './printable.js';
import { walk } from './walk.js';

export type Alignment = 'left' | 'center' | 'right';
/** Character magnification (width/height multipliers, e.g. 2 = double). */
export type TextScale = { width: number; height: number };

/**
 * Pure recursive text extraction — no react-dom, no DOM. Strings/numbers pass
 * through; fragments are transparent. A component element is a mistake (it would
 * be silently dropped — its print() never runs from here), so we throw loudly.
 */
export function toText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number' || typeof node === 'bigint') return String(node);
  if (Array.isArray(node)) return node.map(toText).join('');
  if (isValidElement(node)) {
    if (node.type === Fragment) return toText((node.props as { children?: ReactNode }).children);
    throw new Error(
      'chittie: <Text> (and <Row>) accept only string/number text, not components. ' +
        'Put <Row>, <Image>, etc. as siblings — not nested inside <Text>.'
    );
  }
  return '';
}

const printable = <P,>(fn: (e: Encoder, p: P, ctx: RenderContext) => void) => {
  const comp = (_props: P): null => null;
  (comp as unknown as Printable).print = fn as Printable['print'];
  return comp;
};

export interface PrinterProps {
  /** Characters per line (default 48 / 80mm). */
  width?: number;
  children?: ReactNode;
}
/** Root element — render() reads its props; it has no print() of its own. */
export const Printer = (_props: PrinterProps): null => null;

export interface TextProps {
  align?: Alignment;
  bold?: boolean;
  underline?: boolean | number;
  invert?: boolean;
  size?: TextScale;
  /** Use the printer's smaller built-in font (ESC/POS Font B, ~9×17 vs A 12×24) — fine print. */
  small?: boolean;
  /** If true, don't append a newline after the text. */
  inline?: boolean;
  children?: ReactNode;
}
// Font B is ~0.72× Font A — used to scale the rasterized fallback for `small`.
const FONT_B_SCALE = 0.72;
export const Text = printable<TextProps>((e, p, ctx) => {
  if (p.align) e.align(p.align);
  if (p.bold) e.bold(true);
  if (p.underline) e.underline(p.underline);
  if (p.invert) e.invert(true);
  if (p.size) e.size(p.size.width, p.size.height);
  if (p.small) e.font('B');
  // smartText prints code-page text, or rasterizes complex scripts when a
  // rasterizer is supplied — and throws (never silent "?") when it isn't.
  const rastered = smartText(e, toText(p.children), {
    rasterizer: ctx.rasterizer,
    codepage: ctx.codepage,
    raster: {
      bold: p.bold,
      // Font B has no code page for non-Latin, so shrink the raster to match.
      fontSize: rasterPx(ctx.dpi, (p.size?.height ?? 1) * (p.small ? FONT_B_SCALE : 1)),
      maxWidth: ctx.dotWidth,
      dpi: ctx.dpi,
      fontFamilies: ctx.fontFamilies,
    },
  });
  // A rasterized line already advanced the paper by the image height — adding a
  // newline too would double-space it. Only feed for code-page text.
  if (!p.inline && !rastered) e.newline();
  if (p.small) e.font('A');
  if (p.size) e.size(1, 1);
  if (p.invert) e.invert(false);
  if (p.underline) e.underline(false);
  if (p.bold) e.bold(false);
  if (p.align) e.align('left');
});

export interface RowProps {
  left?: ReactNode;
  right?: ReactNode;
  /** Right-to-left reading order (Arabic/Hebrew): label reads flush-right, value flush-left. */
  rtl?: boolean;
  /**
   * Blank characters always kept between the two cells. Without it a label that
   * exactly fills the remaining width sits flush against the value with nothing
   * separating them; a gap makes the label wrap one character sooner instead.
   * Ignored on a rasterized (non-Latin) row, which lays itself out in dots.
   */
  gap?: number;
  marginLeft?: number;
  marginRight?: number;
  children?: ReactNode;
}
export const Row = printable<RowProps>((e, p, ctx) => {
  const left = clean(toText(p.left));
  const right = clean(toText(p.right));
  // Non-Latin in a cell can't go through code-page text — raster the whole row
  // as one image; throw if no rasterizer. RTL mirrors the cell placement.
  if (needsRaster(left, ctx.codepage) || needsRaster(right, ctx.codepage)) {
    if (!ctx.rasterizer) {
      throw new Error(
        'chittie: <Row> contains non-encodable text (e.g. Sinhala/Tamil/Arabic). Pass a rasterizer to render(), or use code-page text.'
      );
    }
    const img = rasterizeRow(ctx.rasterizer, left, right, {
      dotWidth: ctx.dotWidth,
      fontSize: rasterPx(ctx.dpi),
      dpi: ctx.dpi,
      fontFamilies: ctx.fontFamilies,
      rtl: p.rtl,
    });
    e.image(img, img.width, img.height);
    return;
  }
  // RTL: value (right) flush-left, label (left) flush-right.
  const lead = p.rtl ? right : left;
  const trail = p.rtl ? left : right;
  const gap = p.gap ?? 0;
  const marginLeft = p.marginLeft ?? 0;
  const marginRight = p.marginRight ?? 0;
  const usable = Math.max(1, ctx.columns - marginLeft - marginRight - gap);
  const trailW = Math.min(trail.length, usable);
  const leadW = Math.max(0, usable - trailW);
  e.table(
    [
      { width: leadW, align: 'left', marginLeft },
      { width: trailW, align: 'right', marginLeft: gap, marginRight },
    ],
    [[lead, trail]]
  );
});

export interface LineProps {
  /** Rule style — a single or double stroke. */
  style?: 'single' | 'double';
  /** Rule length in characters. Defaults to the full paper width. */
  width?: number;
  children?: ReactNode;
}
export const Line = printable<LineProps>((e, p) => {
  e.rule({ style: p.style ?? 'single', ...(p.width === undefined ? {} : { width: p.width }) });
});

/**
 * Flatten a cell's subtree to plain text. Unlike `toText` this descends through
 * elements instead of throwing on them, because a cell legitimately holds
 * <Text>/<Row>. Only used to decide whether a row needs rasterizing, and to
 * feed the rasterizer — styling does not survive that path.
 */
function cellText(node: ReactNode): string {
  let out = '';
  for (const child of Children.toArray(node)) {
    if (typeof child === 'string' || typeof child === 'number') {
      out += String(child);
      continue;
    }
    if (isValidElement(child)) {
      const props = (child.props ?? {}) as { children?: ReactNode; left?: ReactNode; right?: ReactNode };
      out += cellText(props.left);
      out += cellText(props.children);
      out += cellText(props.right);
    }
  }
  return out;
}

/**
 * Narrow the render context to a cell. `dotWidth` has to shrink with the column
 * count, or rasterized non-Latin text inside a cell would be laid out against
 * the full paper width and overflow its column.
 */
function cellContext(ctx: RenderContext, columns: number): RenderContext {
  return {
    ...ctx,
    columns,
    dotWidth: Math.max(8, Math.round((ctx.dotWidth * columns) / ctx.columns)),
  };
}

export interface ColumnProps {
  /**
   * Width in characters. Leave it off exactly one column and that column takes
   * whatever the sized columns, margins, and gaps leave over.
   */
  width?: number;
  align?: Alignment;
  /** Where a short cell sits when a sibling wraps to several lines. */
  verticalAlign?: 'top' | 'bottom';
  marginLeft?: number;
  marginRight?: number;
  children?: ReactNode;
}
/** A cell inside <Columns>. Rendered by its parent — never on its own. */
export const Column = (_props: ColumnProps): null => null;

export interface ColumnsProps {
  /** Blank characters inserted between adjacent columns. */
  gap?: number;
  children?: ReactNode;
}
/**
 * A row of columns, each with its own width, alignment, and margins — the
 * general form of <Row>. Cells wrap inside their own width, and a short cell is
 * padded so the row stays aligned. Children must be <Column> elements.
 */
export const Columns = printable<ColumnsProps>((e, p, ctx) => {
  const cells: ColumnProps[] = [];
  for (const child of Children.toArray(p.children)) {
    if (!isValidElement(child)) continue;
    if (child.type !== Column) {
      throw new Error('chittie: <Columns> accepts only <Column> children.');
    }
    cells.push(child.props as ColumnProps);
  }
  if (cells.length === 0) return;

  const gap = p.gap ?? 0;
  const gaps = gap * Math.max(0, cells.length - 1);
  const margins = cells.reduce((n, c) => n + (c.marginLeft ?? 0) + (c.marginRight ?? 0), 0);
  const sized = cells.reduce((n, c) => n + (c.width ?? 0), 0);
  const flexible = cells.filter((c) => c.width === undefined);
  if (flexible.length > 1) {
    throw new Error('chittie: <Columns> allows at most one <Column> without a width.');
  }
  const remainder = Math.max(1, ctx.columns - gaps - margins - sized);

  const definitions = cells.map((c, i) => ({
    width: c.width ?? remainder,
    align: c.align ?? 'left',
    ...(c.verticalAlign === undefined ? {} : { verticalAlign: c.verticalAlign }),
    marginLeft: (c.marginLeft ?? 0) + (i > 0 ? gap : 0),
    marginRight: c.marginRight ?? 0,
  }));

  // The engine refuses an image inside a table cell, so a row carrying
  // non-Latin text can't be assembled per-cell — rasterize the whole row, the
  // same way <Row> does. Cell text only; per-cell styling doesn't survive.
  const texts = cells.map((cell) => clean(cellText(cell.children)));
  if (texts.some((t) => needsRaster(t, ctx.codepage))) {
    if (!ctx.rasterizer) {
      throw new Error(
        'chittie: <Columns> contains non-encodable text (e.g. Sinhala/Tamil/Arabic). Pass a rasterizer to render(), or use code-page text.'
      );
    }
    const perColumn = ctx.dotWidth / ctx.columns;
    const img = rasterizeColumns(
      ctx.rasterizer,
      definitions.map((d, i) => ({
        text: texts[i]!,
        width: Math.round(d.width * perColumn),
        align: d.align,
        marginLeft: Math.round(d.marginLeft * perColumn),
      })),
      {
        dotWidth: ctx.dotWidth,
        fontSize: rasterPx(ctx.dpi),
        dpi: ctx.dpi,
        fontFamilies: ctx.fontFamilies,
      }
    );
    e.image(img, img.width, img.height);
    return;
  }

  e.table(
    definitions,
    [
      cells.map((cell, i) => (cellEncoder: Encoder) => {
        walk(cell.children, cellEncoder, cellContext(ctx, definitions[i]!.width));
      }),
    ]
  );
});

export interface TableColumn {
  /**
   * `undefined` — flexible: takes whatever the other columns leave (at most one
   * column may be flexible).
   * `'auto'` — fit the widest cell in this column, across every row.
   * A number — exactly that many characters.
   */
  width?: number | 'auto';
  align?: Alignment;
  verticalAlign?: 'top' | 'bottom';
  marginLeft?: number;
  marginRight?: number;
}

export interface TableProps {
  /** Column definitions, declared once for every row. */
  columns: TableColumn[];
  /** Blank characters inserted between adjacent columns. */
  gap?: number;
  /** One array of cells per row. A cell is any printable node or plain text. */
  rows: ReactNode[][];
  children?: ReactNode;
}

/**
 * Rows sharing one set of columns. Use it wherever a receipt repeats a line
 * shape — item lines, a totals block — so the columns are declared once and
 * every row is aligned by construction rather than by everyone remembering the
 * same widths.
 *
 * `width: 'auto'` sizes a column to its widest cell across all rows, which a
 * single <Columns> cannot do: it only ever sees one row.
 */
export const Table = printable<TableProps>((e, p, ctx) => {
  const rows = p.rows ?? [];
  if (rows.length === 0 || p.columns.length === 0) return;

  const gap = p.gap ?? 0;
  const count = p.columns.length;
  const texts = rows.map((row) =>
    Array.from({ length: count }, (_, c) => clean(cellText(row[c])))
  );

  const flexible = p.columns.filter((c) => c.width === undefined);
  if (flexible.length > 1) {
    throw new Error('chittie: <Table> allows at most one column without a width.');
  }

  const gaps = gap * Math.max(0, count - 1);
  const margins = p.columns.reduce((n, c) => n + (c.marginLeft ?? 0) + (c.marginRight ?? 0), 0);
  const fixed = p.columns.reduce((n, c) => n + (typeof c.width === 'number' ? c.width : 0), 0);
  let available = Math.max(count, ctx.columns - gaps - margins - fixed);

  // 'auto' wants its widest cell; shrink them together if they don't all fit,
  // and always leave a character for a flexible column.
  const natural = p.columns.map((c, i) =>
    c.width === 'auto' ? Math.max(1, ...texts.map((row) => row[i]!.length)) : 0
  );
  const naturalTotal = natural.reduce((n, w) => n + w, 0);
  const roomForAuto = Math.max(0, available - (flexible.length ? 1 : 0));
  const scale = naturalTotal > roomForAuto && naturalTotal > 0 ? roomForAuto / naturalTotal : 1;
  const auto = natural.map((w) => (w === 0 ? 0 : Math.max(1, Math.floor(w * scale))));
  available -= auto.reduce((n, w) => n + w, 0);

  const definitions = p.columns.map((c, i) => ({
    width:
      typeof c.width === 'number' ? c.width : c.width === 'auto' ? auto[i]! : Math.max(1, available),
    align: c.align ?? 'left',
    ...(c.verticalAlign === undefined ? {} : { verticalAlign: c.verticalAlign }),
    marginLeft: (c.marginLeft ?? 0) + (i > 0 ? gap : 0),
    marginRight: c.marginRight ?? 0,
  }));

  // A row carrying non-Latin text becomes one image (the engine refuses an
  // image inside a table cell). Text rows still batch into a single table()
  // call, and the emit order follows the rows as written.
  const perColumn = ctx.dotWidth / ctx.columns;
  let batch: ReactNode[][] = [];
  const flush = () => {
    if (batch.length === 0) return;
    e.table(
      definitions,
      batch.map((row) =>
        definitions.map(
          (definition, c) => (cellEncoder: Encoder) =>
            walk(row[c], cellEncoder, cellContext(ctx, definition.width))
        )
      )
    );
    batch = [];
  };

  rows.forEach((row, r) => {
    if (!texts[r]!.some((t) => needsRaster(t, ctx.codepage))) {
      batch.push(row);
      return;
    }
    flush();
    if (!ctx.rasterizer) {
      throw new Error(
        'chittie: <Table> contains non-encodable text (e.g. Sinhala/Tamil/Arabic). Pass a rasterizer to render(), or use code-page text.'
      );
    }
    const img = rasterizeColumns(
      ctx.rasterizer,
      definitions.map((definition, c) => ({
        text: texts[r]![c]!,
        width: Math.round(definition.width * perColumn),
        align: definition.align,
        marginLeft: Math.round(definition.marginLeft * perColumn),
      })),
      { dotWidth: ctx.dotWidth, fontSize: rasterPx(ctx.dpi), dpi: ctx.dpi, fontFamilies: ctx.fontFamilies }
    );
    e.image(img, img.width, img.height);
  });
  flush();
});

export interface BoxProps {
  /**
   * Border style. Defaults to `none` — a <Box> is a layout element here, and a
   * border is something you opt into (chittie-core's builder defaults to
   * `single`).
   */
  style?: 'none' | 'single' | 'double';
  /** Width in characters. Defaults to whatever the margins leave. */
  width?: number;
  align?: Alignment;
  marginLeft?: number;
  marginRight?: number;
  paddingLeft?: number;
  paddingRight?: number;
  children?: ReactNode;
}
/**
 * An indented block. Content wraps inside the box, so it is the way to give a
 * continuation line the same indent as its first line — leading whitespace is
 * stripped from <Text> and <Row>, so spaces cannot do it.
 */
export const Box = printable<BoxProps>((e, p, ctx) => {
  const style = p.style ?? 'none';
  const marginLeft = p.marginLeft ?? 0;
  const marginRight = p.marginRight ?? 0;
  const paddingLeft = p.paddingLeft ?? 0;
  const paddingRight = p.paddingRight ?? 0;
  const width = p.width ?? ctx.columns - marginLeft - marginRight;
  const inner = width - (style === 'none' ? 0 : 2) - paddingLeft - paddingRight;
  if (inner < 1) {
    throw new Error('chittie: <Box> has no room left for content — reduce its margins or padding.');
  }

  e.box(
    { style, width, align: p.align ?? 'left', marginLeft, marginRight, paddingLeft, paddingRight },
    (boxEncoder: Encoder) => {
      walk(p.children, boxEncoder, cellContext(ctx, inner));
    }
  );
});

export interface BrProps {
  lines?: number;
  children?: ReactNode;
}
export const Br = printable<BrProps>((e, p) => {
  e.newline(p.lines ?? 1);
});

export interface FeedProps {
  /** Precise vertical space in dots (1 dot ≈ 0.125mm at 203 DPI). Finer than <Br> lines. */
  dots: number;
  children?: ReactNode;
}
/**
 * Feed an exact number of dots (ESC J) — for tuning spacing below a full line.
 * One-shot: it does NOT change global line spacing, so it can't conflict with
 * the image feed. Use <Br lines> for line-level gaps, <Feed dots> for fine ones.
 */
export const Feed = printable<FeedProps>((e, p) => {
  const n = Math.max(0, Math.min(255, Math.round(p.dots)));
  e.raw([0x1b, 0x4a, n]); // ESC J n
});

export interface CutProps {
  partial?: boolean;
  children?: ReactNode;
}
export const Cut = printable<CutProps>((e, p) => {
  e.cut(p.partial ? 'partial' : 'full');
});

export interface CashdrawProps {
  device?: number;
  children?: ReactNode;
}
export const Cashdraw = printable<CashdrawProps>((e, p) => {
  e.pulse(p.device);
});

export interface BarcodeProps {
  value: string;
  symbology?: BarcodeSymbology | number;
  height?: number;
  children?: ReactNode;
}
export const Barcode = printable<BarcodeProps>((e, p) => {
  e.barcode(p.value, p.symbology ?? 'code128', p.height);
});

export interface QRCodeProps {
  value: string;
  size?: number;
  model?: number;
  children?: ReactNode;
}
export const QRCode = printable<QRCodeProps>((e, p) => {
  e.qrcode(p.value, p.model, p.size);
});

export interface ImageProps {
  /** Pixel data (from a <canvas>, decoded PNG, or a rasterizer). */
  image: ImageData;
  /** Output width/height in dots; default the image's own (padded to /8). */
  width?: number;
  height?: number;
  align?: Alignment;
  /** Dithering: 'threshold' (crisp line-art/logos) | 'bayer' | 'floydsteinberg' | 'atkinson' (photos). */
  dither?: DitherAlgorithm;
  threshold?: number;
  children?: ReactNode;
}
export const Image = printable<ImageProps>((e, p) => {
  const img = padTo8(p.image); // ESC/POS raster needs dims multiple of 8
  if (p.align) e.align(p.align);
  e.image(img, p.width ?? img.width, p.height ?? img.height, p.dither, p.threshold);
  if (p.align) e.align('left');
});
