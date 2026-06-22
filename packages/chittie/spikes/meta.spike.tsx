// SPIKE: prove the meta package exposes BOTH authoring styles from one import.
import React from 'react';
import assert from 'node:assert/strict';
import { Printer, Text, Cut, render, ReceiptPrinterEncoder } from '../src/index.js';

// JSX authoring
const viaJsx = render(
  <Printer width={32}>
    <Text align="center" bold>
      Artisan Haus
    </Text>
    <Cut />
  </Printer>
);

// Builder authoring (same engine underneath)
const viaBuilder = new ReceiptPrinterEncoder({ columns: 32 })
  .initialize()
  .align('center')
  .bold(true)
  .line('Artisan Haus')
  .cut()
  .encode();

assert.ok(viaJsx instanceof Uint8Array && viaJsx.length > 0, 'JSX path produces bytes');
assert.ok(viaBuilder instanceof Uint8Array && viaBuilder.length > 0, 'builder path produces bytes');

console.log('✓ chittie meta spike — JSX (' + viaJsx.length + 'b) + builder (' + viaBuilder.length + 'b) from one import');
