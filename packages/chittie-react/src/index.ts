export {
  Printer,
  Text,
  Row,
  Line,
  Br,
  Cut,
  Cashdraw,
  Barcode,
  QRCode,
  toText,
  type Alignment,
  type TextScale,
  type PrinterProps,
  type TextProps,
  type RowProps,
  type BrProps,
  type CutProps,
  type CashdrawProps,
  type BarcodeProps,
  type QRCodeProps,
} from './components.js';
export { render, type RenderOptions } from './render.js';
export type { Encoder, RenderContext } from './printable.js';
// Re-exported for consumers wiring render({ rasterizer }) for Sinhala/Tamil.
export type { TextRasterizer, RasterOptions, Codepage } from '@angadie/chittie-text';
