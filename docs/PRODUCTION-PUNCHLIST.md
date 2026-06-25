# Production punch list

The concrete, remaining items to call each surface production-ready. `[ ]` open · `[x]` done ·
`[~]` partial. **(hw)** = needs hardware/a device I can't self-verify · **(ext)** = external/paid/your
account · **(me)** = I can do it from here.

> Status today: the **npm packages** are published and proven on a real 58mm printer (incl. Sinhala).
> The **companion app**, **RN package**, and **hosted-web-POS** surfaces have the gated items below.

## A. npm packages (@angadie/chittie*) — closest to production
- [x] Published, semver via changesets, no `workspace:*` leaks.
- [x] Real-hardware proof: receipt + Sinhala on a 58mm ET PR-10.
- [x] Spacing audited — tight; non-Latin double-feed fixed (0.7.0/0.8.0).
- [ ] **(me)** `ci.yml` — run `pnpm check` on PRs (currently only local).
- [ ] **(me)** README badges + reactnative.directory listing.
- [ ] **(hw)** Label (TSPL) verified on a real label printer.
- [ ] **(hw)** Print status (`queryStatus`) verified against real paper-out/cover-open.

## B. Companion app (merchant installer) — biggest gap to "ship to store owners"
- [x] Builds; macOS + Windows installers in a draft release; autostart + close-to-tray + auto-detect.
- [ ] **(ext)** **Code signing + notarization** — macOS (Apple Dev $99/yr) + Windows cert (~$200–500/yr).
  Until then installers throw SmartScreen/Gatekeeper warnings → blocker for non-technical owners.
- [ ] **(hw)** **Run the `.exe` on a real Windows machine** — only built, never executed on Windows.
- [ ] **(me+ext)** **Verify the auto-updater** — publish a release, then ship a bump and confirm a
  client actually updates (the signing key secret is set; the flow is unexercised).
- [ ] **(me)** Fix the **Linux** build job (mac+win green; linux failed).
- [ ] **(hw)** On-device print through the installed companion (pin printer → real receipt).
- [ ] **(me)** Paper-size picker in the UI (agent already declares it on `/health`).

## C. Hosted web POS (any browser → localhost companion)
- [x] PNA header → Chrome/Edge/Firefox hosted POS reach localhost.
- [ ] **(me+ext)** **localhost TLS (Path B)** for Safari/iPad — a loopback domain
  (`printer.<domain>` → `127.0.0.1`) + a real cert served via `rustls`. Needs a domain (ext) +
  the TLS code (me). See `docs/localhost-tls.md`.

## D. @angadie/chittie-react-native (Nitro)
- [x] bob build, `nitrogen` committed, adapter spike + typecheck green, native template in place.
- [ ] **(hw)** `pod install` + iOS/Android **compile** in a dev client.
- [ ] **(hw)** On-device **glyph snapshot** (Sinhala/Tamil/Arabic render correctly).
- [ ] **(me)** `npm publish` — held until the two device checks above pass.
- [ ] **(future)** Phase 2: read-capable BLE transport + status; Phase 3: USB/TCP.

## E. Narrative (the build-in-public flywheel)
- [ ] **(me)** First posts: "Printing Sinhala/Tamil with no code page"; "Why not a Nitro module
  (and when we did)"; "Hermes-in-CI"; "The print bug only real hardware shows" (the 58mm double-feed).

---

## The shortest path to a first "production" call
If "production" = **the companion installer in a real merchant's hands**, the minimum is **B**:
1. **(ext)** sign + notarize, 2. **(hw)** run the `.exe` on Windows, 3. **(me+ext)** verify auto-update.
Everything else (labels, status, RN, Safari) is gated on whether that *feature* is in your v1 scope.

The hardware/signing items are genuinely yours to drive (a device + paid certs); the rest I can do.
