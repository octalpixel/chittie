/** table()/box() layout options are usable without over-specifying. */
import ReceiptPrinterEncoder from '../src/index.js';

const COLUMNS = 32;
let failed = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
  if (!ok) failed++;
};
const lines = (fn) => {
  const e = new ReceiptPrinterEncoder({columns: COLUMNS});
  e.initialize();
  fn(e);
  return Buffer.from(e.encode()).toString('latin1')
      .replace(/\x1b@|\x1c\.|\x1bM.|\x1bt.|\x1ba./g, '')
      .split('\n').map((l) => l.replace(/\r/g, '')).filter((l) => l.length);
};

/* align is optional in the type — it must be optional in the code too. */
{
  let threw = null;
  try {
    lines((e) => e.table([{width: 20}, {width: 12}], [['Flat White', '1,700.00']]));
  } catch (err) {
    threw = err.message;
  }
  check('table() without align', threw === null, threw || '');
}

/* Margins must not push a default-width box off the paper. */
{
  let threw = null;
  let out = [];
  try {
    out = lines((e) => e.box({style: 'none', marginLeft: 4}, 'Hand embroidery on the neckline'));
  } catch (err) {
    threw = err.message;
  }
  check('box() with a margin and no explicit width', threw === null, threw || '');
  check('box() margin indents the content', out.every((l) => l.startsWith('    ')),
    JSON.stringify(out[0] || ''));
  check('box() content stays on the paper', out.every((l) => l.length <= COLUMNS),
    `widest=${Math.max(0, ...out.map((l) => l.length))}`);
}

/* Column margins put real gaps between cells. */
{
  const out = lines((e) => e.table(
      [{width: 3}, {width: 18, marginLeft: 1}, {width: 9, align: 'right', marginLeft: 1}],
      [['2x', 'Almond Croissant', '650.00']],
  ));
  const expected = '2x '.padEnd(3) + ' ' + 'Almond Croissant'.padEnd(18) + ' ' + '650.00'.padStart(9);
  check('table() honours per-column margins', out[0] === expected,
    `got ${JSON.stringify(out[0])} want ${JSON.stringify(expected)}`);
  check('table() row fills exactly one line', out[0].length === COLUMNS, `len=${out[0].length}`);
}

console.log(failed === 0 ? '\nOK — layout options usable' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
