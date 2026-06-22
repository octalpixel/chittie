// chittie-core: vendored ReceiptPrinterEncoder (builder engine). See VENDOR.md.
//
// RN gotcha: older Hermes lacks structuredClone(), which the vendored
// text-style.js uses. Install a feature-detected shim before loading the
// encoder. The cloned value is a plain style object (booleans/numbers/strings),
// so a JSON round-trip is an exact clone here.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (value) => JSON.parse(JSON.stringify(value));
}

export { default } from './receipt-printer-encoder.js';
export { default as ReceiptPrinterEncoder } from './receipt-printer-encoder.js';
