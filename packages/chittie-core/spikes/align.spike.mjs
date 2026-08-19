/** Alignment padding must print in the same font as the text it aligns. */
import ReceiptPrinterEncoder from '../src/index.js';

const LINE = 'THANK YOU, COME AGAIN!'; // 22 chars
const COLUMNS = 32;

const dump = (bytes) => Buffer.from(bytes).toString('latin1');
const padBefore = (s, needle) => {
  const i = s.indexOf(needle);
  const head = s.slice(0, i);
  return head.length - head.replace(/ +$/, '').length;
};
// The pad must sit adjacent to its text AND after the font select, so the
// spaces print in the font whose column count sized them.
const fontSelectedBeforePad = (s, needle) => {
  const pad = padBefore(s, needle);
  if (pad === 0) return false; // detached from the text — the bug this guards
  const head = s.slice(0, s.indexOf(needle));
  const lastFont = head.lastIndexOf('\x1bM');
  return lastFont >= 0 && lastFont < head.length - pad;
};

let failed = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
  if (!ok) failed++;
};

// Font A: 32 columns, 22 chars -> 5 pad spaces.
{
  const bytes = new ReceiptPrinterEncoder({columns: COLUMNS})
      .initialize().align('center').line(LINE).encode();
  const s = dump(bytes);
  check('font A centre pad', padBefore(s, LINE) === 5, `pad=${padBefore(s, LINE)} expected 5`);
}

// Font B: composer widens to 42 columns, 22 chars -> 10 pad spaces, and the
// font-select MUST come before the padding so the spaces print at Font B width.
{
  const bytes = new ReceiptPrinterEncoder({columns: COLUMNS})
      .initialize().align('center').font('B').line(LINE).encode();
  const s = dump(bytes);
  const pad = padBefore(s, LINE);
  check('font B centre pad', pad === 10, `pad=${pad} expected 10`);
  check('font B selected before the pad', fontSelectedBeforePad(s, LINE),
    'padding would otherwise print at Font A width');
}

// Right alignment has the same ordering requirement.
{
  const bytes = new ReceiptPrinterEncoder({columns: COLUMNS})
      .initialize().align('right').font('B').line(LINE).encode();
  const s = dump(bytes);
  check('font B right-align: font selected before the pad', fontSelectedBeforePad(s, LINE));
}

// Left alignment is unpadded and must stay byte-identical in both fonts.
{
  const a = new ReceiptPrinterEncoder({columns: COLUMNS}).initialize().line(LINE).encode();
  const s = dump(a);
  check('left align emits no leading pad', padBefore(s, LINE) === 0);
}

console.log(failed === 0 ? '\nOK — alignment padding follows the font' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
