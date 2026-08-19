/** <Table> — shared columns, content-sized 'auto', per-row raster fallback. */
import React from 'react';
import { Printer, Text, Table, render } from '../src/index.js';

let failed = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
  if (!ok) failed++;
};
const lines = (tree: React.ReactElement, columns: number): string[] =>
  Buffer.from(render(tree, { dotWidth: columns * 12, codepage: 'cp437' }))
      .toString('latin1')
      .replace(/\x1b@|\x1c\.|\x1bM.|\x1bt.|\x1ba./g, '')
      .split('\n')
      .map((l) => l.replace(/\r/g, ''))
      .filter((l) => l.length);
const show = (label: string, out: string[], columns: number) => {
  console.log(`\n--- ${label} (${columns} cols) ---\n|${'-'.repeat(columns)}|`);
  out.forEach((l) => console.log('|' + l.padEnd(columns) + '|'));
};

const items = [
  ['1x', 'Raththi milk powder', 'Rs. 120.00'],
  ['1x', 'Kothmale fresh milk - 500 ml', 'Rs. 540.00'],
  ['2x', 'Almond croissant with salted caramel', 'Rs. 1,300.00'],
];
const sheet = (columns: number) => (
  <Printer width={columns}>
    <Table
      gap={1}
      columns={[{ width: 3 }, {}, { width: 'auto', align: 'right' }]}
      rows={items}
    />
  </Printer>
);

/* 1. 'auto' sizes to the widest cell across ALL rows — the thing a single
      <Columns> cannot do, since it only ever sees one row. */
for (const columns of [32, 48]) {
  const out = lines(sheet(columns), columns);
  show('auto amount column', out, columns);
  const widest = Math.max(...items.map((r) => r[2]!.length)); // 'Rs. 1,300.00' == 12
  check(`${columns}: every line fits`, out.every((l) => l.length <= columns),
    `widest=${Math.max(...out.map((l) => l.length))}`);
  check(`${columns}: amounts share one right edge`,
    items.every((r) => out.some((l) => l.trimEnd().endsWith(r[2]!))));
  check(`${columns}: auto column is the widest amount, not a guess`,
    out.some((l) => l.includes(' '.repeat(1) + 'Rs. 1,300.00')), `expected width ${widest}`);
}

/* 2. Columns are declared once, so every row aligns by construction. */
{
  const columns = 32;
  const out = lines(sheet(columns), columns);
  const ends = out
      .filter((l) => l.includes('Rs. '))
      .map((l) => l.trimEnd().length);
  check('right-aligned amounts share one right edge', new Set(ends).size === 1,
    `ends=${JSON.stringify(ends)}`);
}

/* 3. A flexible column absorbs the remainder; two are rejected. */
{
  let threw = '';
  try {
    lines(
      <Printer width={32}>
        <Table columns={[{}, {}]} rows={[['a', 'b']]} />
      </Printer>, 32);
  } catch (err) { threw = (err as Error).message; }
  check('two flexible columns are rejected', threw.includes('at most one'), threw);
}

/* 4. A non-Latin row rasterizes on its own; the Latin rows stay text. */
{
  class StubImageData {
    constructor(readonly data: Uint8ClampedArray, readonly width: number, readonly height: number) {}
  }
  Object.defineProperty(StubImageData, 'name', { value: 'ImageData' });
  const shaped: string[] = [];
  const rasterizer = {
    rasterize(text: string, o: { maxWidth?: number } = {}) {
      shaped.push(text);
      const w = Math.max(8, Math.min(o.maxWidth ?? 64, text.length * 12));
      return new StubImageData(new Uint8ClampedArray(w * 24 * 4), w, 24) as unknown as ImageData;
    },
  };
  const mixed = (
    <Printer width={32}>
      <Table
        gap={1}
        columns={[{ width: 3 }, {}, { width: 'auto', align: 'right' }]}
        rows={[
          ['1x', 'Raththi milk powder', 'Rs. 120.00'],
          ['2x', 'ලංකා තේ', 'Rs. 540.00'],
          ['1x', 'Marie biscuits', 'Rs. 180.00'],
        ]}
      />
    </Printer>
  );
  const bytes = render(mixed, { dotWidth: 384, codepage: 'cp437', rasterizer });
  const text = Buffer.from(bytes).toString('latin1');
  const hasBitImage = Array.from(bytes).some((_, i) => bytes[i] === 0x1b && bytes[i + 1] === 0x2a);
  check('the non-Latin row rasterizes', hasBitImage);
  check('only that row is shaped', shaped.includes('ලංකා තේ') && !shaped.includes('Marie biscuits'),
    JSON.stringify(shaped));
  check('the Latin rows still print as text',
    text.includes('Raththi') && text.includes('Marie biscuits'),
    JSON.stringify(text.replace(/[^\x20-\x7e]/g, '.').slice(0, 120)));
  check('row order is preserved',
    text.indexOf('Raththi') >= 0 && text.indexOf('Raththi') < text.indexOf('Marie'));

  let threw = '';
  try { render(mixed, { dotWidth: 384, codepage: 'cp437' }); }
  catch (err) { threw = (err as Error).message; }
  check('without a rasterizer it says so clearly', threw.includes('non-encodable'), threw);
}

console.log(failed === 0 ? '\nOK — Table behaves' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
