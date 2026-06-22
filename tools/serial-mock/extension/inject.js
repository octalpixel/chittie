// Runs in the page's MAIN world at document_start, before the app reads
// navigator.serial. Replaces it with a fake port whose writer captures the
// ESC/POS bytes the app sends, exposes them on window.__escpos for the console,
// and posts them to the ISOLATED-world relay (which forwards to the server).
(() => {
  window.__escpos = [];

  const emit = (chunk) => {
    const bytes = Array.from(chunk);
    window.__escpos = window.__escpos.concat(bytes);
    window.postMessage({ source: 'chittie-serial-mock', kind: 'write', bytes }, '*');
    console.log('[serial-mock] captured', bytes.length, 'ESC/POS bytes');
  };

  const fakePort = {
    open: async () => {},
    close: async () => {},
    getInfo: () => ({ usbVendorId: 0x0416, usbProductId: 0x5011 }), // looks like an XP-365B-class device
    readable: null,
    writable: new WritableStream({ write: emit }),
  };

  Object.defineProperty(navigator, 'serial', {
    configurable: true,
    value: {
      requestPort: async () => fakePort,
      getPorts: async () => [fakePort],
      addEventListener() {},
      removeEventListener() {},
    },
  });

  console.log('[serial-mock] navigator.serial mocked — printing will be captured, not sent to hardware.');
})();
