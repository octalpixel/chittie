// Runs in the ISOLATED content-script world. Receives captured bytes from the
// MAIN-world inject.js via window.postMessage and forwards them to the print-agent
// (run with PRINT_AGENT_VIRTUAL=1 to render a PNG). Content-script fetch to a host
// in host_permissions bypasses page CSP.
const AGENT = 'http://localhost:8930/print';

window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || d.source !== 'chittie-serial-mock' || d.kind !== 'write') return;
  fetch(AGENT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bytes: d.bytes }),
  }).catch((err) => console.warn('[serial-mock] relay failed (is the print-agent running?)', err));
});
