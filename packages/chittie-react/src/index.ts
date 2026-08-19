export {
  Printer,
  Text,
  Row,
  Line,
  Columns,
  Column,
  Table,
  Box,
  Br,
  Feed,
  Cut,
  Cashdraw,
  Barcode,
  QRCode,
  Image,
  toText,
  type Alignment,
  type TextScale,
  type PrinterProps,
  type TextProps,
  type RowProps,
  type LineProps,
  type ColumnsProps,
  type ColumnProps,
  type TableProps,
  type TableColumn,
  type BoxProps,
  type BrProps,
  type FeedProps,
  type CutProps,
  type CashdrawProps,
  type BarcodeProps,
  type QRCodeProps,
  type ImageProps,
} from './components.js';
export { render, PRINTER_PROFILES, type RenderOptions } from './render.js';
export type { Encoder, RenderContext } from './printable.js';
// Re-exported for consumers wiring render({ rasterizer }) for Sinhala/Tamil.
export type { TextRasterizer, RasterOptions, Codepage } from '@angadie/chittie-text';
// Receipt content helpers — RN-safe money formatting (no Intl), text utilities.
export { formatMoney, foldTypographic, sanitizeControl, needsRaster, dotsPerMm, type MoneyOptions } from '@angadie/chittie-text';
