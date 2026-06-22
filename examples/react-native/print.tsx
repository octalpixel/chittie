import { Printer, Text, Row, Line, Cut, render } from '@angadie/chittie';
import type { TextRasterizer } from '@angadie/chittie';
import { print } from '@angadie/chittie-transport';
import { createBleTransport } from '@angadie/chittie-transport-react-native';

/**
 * Platform-agnostic print routine. You provide:
 *  - `write`: your BLE library's characteristic-write (e.g. react-native-ble-plx)
 *  - `rasterizer`: a TextRasterizer (e.g. react-native-skia) for Sinhala/Tamil
 *
 * See README.md for wiring `write` to react-native-ble-plx and a Skia rasterizer.
 */
export async function printReceipt(
  write: (bytes: Uint8Array) => Promise<void>,
  rasterizer: TextRasterizer
): Promise<void> {
  const receipt = (
    <Printer width={32}>
      <Text align="center" bold>
        Artisan Haus
      </Text>
      {/* Sinhala — auto-rasterized via the injected rasterizer */}
      <Text align="center">ආයුබෝවන්!</Text>
      <Line />
      <Row left="Tea" right="Rs. 120" />
      <Row left="Roti" right="Rs. 80" />
      <Line />
      <Row left="TOTAL" right="Rs. 200" />
      <Cut />
    </Printer>
  );

  const bytes = render(receipt, { rasterizer });
  const transport = createBleTransport(write); // BLE MTU chunking applied for you
  await print(transport, bytes);
}
