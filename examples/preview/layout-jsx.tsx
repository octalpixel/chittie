/**
 * Visual check of the layout elements — <Row gap>, <Columns>/<Column>, <Box>,
 * <Line style|width> — rendered to PNG at both paper profiles.
 *
 *   pnpm --filter @angadie/example-preview preview:layout
 */
import React from 'react';
import { writeFileSync } from 'node:fs';
import { createCanvas, ImageData as NapiImageData } from '@napi-rs/canvas';
import { renderReceipt } from '@angadie/chittie-preview';
import {
  Printer, Text, Row, Line, Columns, Column, Table, Box, Feed, Cut, render, PRINTER_PROFILES,
} from '@angadie/chittie';

(globalThis as unknown as { ImageData: unknown }).ImageData ??= NapiImageData;

const items = [
  { qty: 1, name: 'Raththi milk powder', amount: 'Rs. 120.00' },
  { qty: 1, name: 'Kothmale fresh milk - 500 ml', amount: 'Rs. 540.00' },
  { qty: 2, name: 'Almond croissant with salted caramel', amount: 'Rs. 1,300.00' },
];

const sheet = (columns: number) => (
  <Printer width={columns}>
    <Text align="center" bold size={{ width: 2, height: 2 }}>Xustore</Text>
    <Text align="center">Galle road, Nupe, Matara</Text>

    <Line style="double" />

    <Text bold>Row — no gap (label can touch the value)</Text>
    <Row left="1x Raththi milk powder" right="Rs. 120.00" />

    <Text bold>Row gap={1} — always a separator</Text>
    <Row left="1x Raththi milk powder" right="Rs. 120.00" gap={1} />

    <Line />

    <Text bold>Table — columns declared once, amount width auto</Text>
    <Table
      gap={1}
      columns={[{ width: 3 }, {}, { width: 'auto', align: 'right' }]}
      rows={items.map((it) => [`${it.qty}x`, it.name, it.amount])}
    />

    <Line />

    <Text bold>Columns — one-off row</Text>
    <Columns gap={1}>
      <Column width={3}>2x</Column>
      <Column>Flat White</Column>
      <Column width={12} align="right">Rs. 1,700.00</Column>
    </Columns>

    <Line />

    <Text bold>Box — indented continuation</Text>
    <Row left="2x Batik scarf - orchid" right="Rs. 20,600.00" gap={1} />
    <Box marginLeft={3}>
      <Row left="+ Hand embroidery on neckline and cuffs" right="Rs. 8,000.00" gap={1} />
    </Box>

    <Line />

    <Text bold>Box — bordered notice</Text>
    <Box style="single" marginLeft={1} marginRight={1} paddingLeft={1} paddingRight={1}>
      <Text align="center">Exchange within 7 days with this receipt</Text>
    </Box>

    <Line width={12} />

    <Feed dots={24} />
    <Text align="center" small>Powered by chittie</Text>
    <Cut />
  </Printer>
);

for (const profile of ['58mm', '80mm'] as const) {
  const { columns, dotWidth } = PRINTER_PROFILES[profile];
  const bytes = render(sheet(columns), { dotWidth, codepage: 'cp437' });
  // 'monospace' resolves to a face without box-drawing glyphs on some hosts,
  // so rules and box borders come out as tofu. Menlo/DejaVu cover cp437.
  const canvas = renderReceipt(bytes, {
    createCanvas,
    columns,
    fontFamily: 'Menlo, DejaVu Sans Mono, Consolas, monospace',
  });
  const out = new URL(`./layout-${profile}.png`, import.meta.url).pathname;
  writeFileSync(out, canvas.toBuffer('image/png'));
  console.log(`${profile}: ${out}  ${bytes.length} bytes -> ${canvas.width}x${canvas.height}px`);
}
