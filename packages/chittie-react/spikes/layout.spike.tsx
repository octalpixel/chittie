/** <Columns>/<Column>/<Box>/<Row gap>/<Line style|width> at 32 columns. */
import React from 'react';
import { Printer, Text, Row, Line, Columns, Column, Box, render } from '../src/index.js';

const COLUMNS = 32;
let failed = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
  if (!ok) failed++;
};
const lines = (tree: React.ReactElement): string[] =>
  Buffer.from(render(tree, { dotWidth: COLUMNS * 12, codepage: 'cp437' }))
      .toString('latin1')
      .replace(/\x1b@|\x1c\.|\x1bM.|\x1bt.|\x1ba./g, '')
      .split('\n')
      .map((l) => l.replace(/\r/g, ''))
      .filter((l) => l.length);

const show = (label: string, out: string[]) => {
  console.log(`\n--- ${label} ---\n|${'-'.repeat(COLUMNS)}|`);
  out.forEach((l) => console.log('|' + l.padEnd(COLUMNS) + '|'));
};

/* 1. A label that exactly fills the line must not touch the value.
      '1x Raththi milk powder' (22) + 'Rs. 120.00' (10) == 32 exactly — the real
      receipt case where the price ended up glued to the product name. */
{
  const NAME = '1x Raththi milk powder';
  const PRICE = 'Rs. 120.00';
  if (NAME.length + PRICE.length !== COLUMNS) {
    throw new Error(`spike setup: expected an exact fill, got ${NAME.length + PRICE.length}`);
  }
  const tight = lines(
    <Printer width={COLUMNS}><Row left={NAME} right={PRICE} /></Printer>);
  const spaced = lines(
    <Printer width={COLUMNS}><Row left={NAME} right={PRICE} gap={1} /></Printer>);
  show('Row without gap (exact fill)', tight);
  show('Row gap={1} (exact fill)', spaced);
  check('without a gap the value touches the label', tight[0] === NAME + PRICE,
    JSON.stringify(tight[0]));
  check('gap separates them', spaced.every((l) => !l.includes('powderRs.')),
    JSON.stringify(spaced[0]));
  check('gap wraps the label instead of gluing', spaced.length > tight.length,
    `tight=${tight.length} spaced=${spaced.length}`);
  check('gap keeps every line on the paper', spaced.every((l) => l.length <= COLUMNS));
}

/* 2. Columns: one flexible column absorbs the remainder. */
{
  const out = lines(
    <Printer width={COLUMNS}>
      <Columns gap={1}>
        <Column width={3}><Text>2x</Text></Column>
        <Column><Text>Almond Croissant with caramel</Text></Column>
        <Column width={9} align="right"><Text>650.00</Text></Column>
      </Columns>
    </Printer>);
  show('Columns with a flexible middle', out);
  check('every line fits the paper', out.every((l) => l.length <= COLUMNS),
    `widest=${Math.max(...out.map((l) => l.length))}`);
  check('quantity and amount share the first line',
    out[0]!.startsWith('2x') && out[0]!.trimEnd().endsWith('650.00'), JSON.stringify(out[0]));
  check('the wrapped remainder is indented under the name',
    out.length > 1 && out[1]!.startsWith('    '), JSON.stringify(out[1]));
}

/* 3. Box: an indented block, which leading spaces cannot produce. */
{
  const out = lines(
    <Printer width={COLUMNS}>
      <Box marginLeft={4}><Text>Hand embroidery on the neckline and cuffs</Text></Box>
    </Printer>);
  show('Box marginLeft={4}', out);
  check('every wrapped line carries the indent', out.every((l) => l.startsWith('    ')));
  check('box stays on the paper', out.every((l) => l.length <= COLUMNS));
}

/* 4. Box with a border, and Line styles. */
{
  const out = lines(
    <Printer width={COLUMNS}>
      <Box style="single" marginLeft={1} marginRight={1} paddingLeft={1} paddingRight={1}>
        <Text align="center">Refund within 7 days</Text>
      </Box>
      <Line style="double" />
      <Line width={10} />
    </Printer>);
  show('Box border + Line styles', out);
  check('border box fits', out.every((l) => l.length <= COLUMNS));
  check('partial rule is shorter than the paper',
    out[out.length - 1]!.trimEnd().length === 10, JSON.stringify(out[out.length - 1]));
}

/* 5. Guard rails. */
{
  let threw = '';
  try {
    lines(<Printer width={COLUMNS}><Columns><Column /><Column /></Columns></Printer>);
  } catch (err) { threw = (err as Error).message; }
  check('two flexible columns are rejected', threw.includes('at most one'), threw);

  threw = '';
  try {
    lines(<Printer width={COLUMNS}><Columns><Text>nope</Text></Columns></Printer>);
  } catch (err) { threw = (err as Error).message; }
  check('non-<Column> children are rejected', threw.includes('only <Column>'), threw);
}

/* 6. A non-Latin cell rasterizes the whole row (the engine refuses an image
      inside a table cell), laid out against the paper, not a cell. */
{
  // chittie reuses the returned object's constructor to build the row canvas,
  // and the core sniffs `constructor.name` to accept the image — so the
  // stand-in must be a class called ImageData, not an object literal.
  class StubImageData {
    constructor(
      readonly data: Uint8ClampedArray,
      readonly width: number,
      readonly height: number
    ) {}
  }
  Object.defineProperty(StubImageData, 'name', { value: 'ImageData' });
  const seen: { text: string; maxWidth?: number }[] = [];
  const rasterizer = {
    rasterize(text: string, opts: { maxWidth?: number } = {}) {
      seen.push({ text, maxWidth: opts.maxWidth });
      const w = Math.max(8, Math.min(opts.maxWidth ?? 64, text.length * 12));
      return new StubImageData(new Uint8ClampedArray(w * 24 * 4), w, 24) as unknown as ImageData;
    },
  };
  const tree = (
    <Printer width={COLUMNS}>
      <Columns gap={1}>
        <Column width={3}><Text>2x</Text></Column>
        <Column><Text>ලංකා තේ</Text></Column>
        <Column width={9} align="right"><Text>650.00</Text></Column>
      </Columns>
    </Printer>
  );
  const bytes = render(tree, { dotWidth: COLUMNS * 12, codepage: 'cp437', rasterizer });
  check('non-Latin row rasterizes rather than throwing', bytes.length > 0);
  check('every cell is shaped', seen.length === 3, `shaped ${seen.length}`);
  const flexWidth = COLUMNS - 3 - 9 - 2; // paper minus sized columns minus two gaps
  check('the non-Latin cell is capped to its column',
    seen[1]!.maxWidth === Math.round(flexWidth * 12),
    `maxWidth=${seen[1]!.maxWidth} expected ${Math.round(flexWidth * 12)}`);
  // This encoder emits rasters as ESC * bit-image, not GS v 0.
  const hasBitImage = Array.from(bytes).some((_, i) => bytes[i] === 0x1b && bytes[i + 1] === 0x2a);
  check('a raster row emits a bit image (ESC *)', hasBitImage);

  let threw = '';
  try {
    render(tree, { dotWidth: COLUMNS * 12, codepage: 'cp437' });
  } catch (err) { threw = (err as Error).message; }
  check('without a rasterizer it says so clearly', threw.includes('non-encodable'), threw);
}

console.log(failed === 0 ? '\nOK — layout elements behave' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
