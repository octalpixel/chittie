import { Printer, Text, Row, Line, Cut, render } from '@angadie/chittie';
import { print } from '@angadie/chittie-transport';
import { createWebSerialTransport } from '@angadie/chittie-transport-web';
import { canvasRasterizer } from './canvas-rasterizer.js';

const receipt = (
  <Printer width={48}>
    <Text align="center" bold size={{ width: 2, height: 2 }}>
      Artisan Haus
    </Text>
    {/* Sinhala — auto-rasterized via the injected canvasRasterizer */}
    <Text align="center">ආයුබෝවන්!</Text>
    <Line />
    <Row left="Flat White" right="Rs. 850" />
    <Row left="Croissant" right="Rs. 650" />
    <Line />
    <Row left="TOTAL" right="Rs. 1500" />
    <Cut />
  </Printer>
);

// One transport instance; connect() (inside print) prompts for the serial port
// on first use and reconnects silently afterwards.
const transport = createWebSerialTransport();

document.querySelector<HTMLButtonElement>('#print')!.addEventListener('click', async () => {
  const bytes = render(receipt, { rasterizer: canvasRasterizer() });
  await print(transport, bytes);
});
