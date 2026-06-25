# Decision: trusted HTTPS for hosted web POS → localhost companion

## Context

A **hosted** (public, HTTPS) web POS in a browser needs to reach the **companion** running on
the till at `http://localhost:8930`. The question: does the browser allow it, and if not, how do
we make it work in **every** browser a merchant might use — including Safari/iPad?

This only affects a **pure hosted web POS in a browser**. A **Tauri-wrapped POS** (e.g. ordereka)
prints via an in-process command and never makes a hosted→localhost hop, so it is unaffected.

## The facts (corrected — it is *not* "mixed content")

`http://localhost` / `127.0.0.1` are **"potentially trustworthy" secure origins**, so an HTTPS
page calling `http://localhost` is **not** classic mixed-content-blocked. The real gate differs
by browser:

| Browser | Hosted HTTPS → `http://localhost` | Requirement |
|---|---|---|
| Chrome / Edge | works | CORS **+ Private Network Access** preflight reply `Access-Control-Allow-Private-Network: true` |
| Firefox | works | CORS (no PNA enforcement) |
| Safari / iPad | usually **blocked** | needs a **real hostname + trusted TLS** on localhost |

## Status

- **Done:** the agent sends CORS **and** the PNA header (`tools/print-agent/src/server.rs`), so a
  hosted POS prints on **Chrome / Edge / Firefox** — the majority of Windows tills.
- **Open:** **Safari / iPad** — needs trusted HTTPS on localhost.

## Options for Safari + universal coverage

**Path A — local CA installed in the system trust store** (portless / mkcert / QZ Tray):
the companion generates a CA on first run, installs it into the OS trust store, issues a cert for a
local hostname, serves HTTPS. Fully offline, no domain.
- Cost: writing the trust store needs **elevation**, and AV / MDM on locked-down retail tills often
  **flag or block** it. Also needs an `/etc/hosts` entry (portless does this) because Safari won't
  resolve bare `*.localhost`. Good for *developer* machines; friction for non-technical owners.

**Path B — public cert for a loopback domain** (Plaid Link model):
own a domain, publish a **public A-record** `printer.chittie.dev → 127.0.0.1`, obtain a **real
Let's Encrypt cert** for it, and **bundle cert+key** in the companion. The POS calls
`https://printer.chittie.dev:8930`.
- Works in **every** browser incl Safari via *real* public DNS + *real* cert — **no trust-store
  write, no `/etc/hosts` edit, no elevation.**
- Cost: own a domain; ship a cert/key (localhost-only → low risk); renew it (ship long-lived /
  auto-renew).

## Decision

For a **non-technical store-owner product, choose Path B** (public loopback cert). It avoids the
trust-store / elevation / AV friction that is Path A's one rough edge, and it is the only option
that "just works" in Safari/iPad without per-machine setup. Path A remains the right choice if the
audience is developers (which is portless's actual use case).

Keep **plain HTTP the default** for now (Tauri-embedded POS and Chrome/Edge hosted POS already
work); enable **TLS behind a flag/config** and turn it on once the loopback domain + cert pipeline
exists.

## Implementation (Path B)

1. Register a domain; publish `printer.<domain>` **A → 127.0.0.1** (public DNS).
2. Issue a real cert (Let's Encrypt DNS-01); store cert+key as companion config.
3. Serve HTTPS in the agent with **`rustls`** (cert/key from config); keep `:8930` HTTP unless TLS
   is enabled. Generate dev certs in-process with **`rcgen`** for local testing.
4. POS targets `https://printer.<domain>:8930`; the SDK `url` option already supports this.
5. Renewal: ship a long-lived cert or auto-renew; document rotation.

## What we are NOT building

The local reverse-proxy / ephemeral-port / framework-detection machinery in portless is
dev-tooling, not relevant here. We need only the **trusted-HTTPS-on-localhost** mechanism.

## Notes on tooling

- **portless** (vercel-labs) is **TypeScript**, not Rust; it uses Path A (local CA + `/etc/hosts`
  sync for Safari).
- The famous standalone CLIs for the cert-trust job (**mkcert**, **Caddy**) are **Go**; there is no
  famous Rust binary equivalent.
- In Rust it is **libraries, not a binary** — `rcgen` (CA/leaf cert generation) + `rustls` (serve
  TLS) — so the companion does it **in-process**, no sidecar.

## References

- portless — https://github.com/vercel-labs/portless (Path A reference)
- mkcert — local CA technique
- Plaid Link / Spotify / Discord — public-loopback-cert technique (Path B)
- Private Network Access (Chrome/Edge preflight) — the header now sent by the agent
