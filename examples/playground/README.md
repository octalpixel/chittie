# chittie playground

Author a receipt in the browser → ESC/POS bytes → **live PNG preview** (via
`@angadie/chittie-preview`) → **print to your USB/serial printer** (Web Serial,
`@angadie/chittie-transport-web`). Non-Latin scripts (Sinhala/Tamil) are
auto-rasterized through the OS fonts — the chittie differentiator.

```bash
pnpm install
pnpm --filter @angadie/example-playground dev      # http://localhost:5173
pnpm --filter @angadie/example-playground bundle   # production build → dist/
```

- **Preview** works everywhere (renders bytes → canvas → PNG).
- **Print via Web Serial** needs a Chromium browser (Chrome/Edge) and a USB/serial
  ESC/POS printer; it prompts for the port. Safari/Firefox don't ship Web Serial —
  use the print-agent bridge transport there instead.
- Deployable as a static site (the story asset: "try chittie in your browser").
