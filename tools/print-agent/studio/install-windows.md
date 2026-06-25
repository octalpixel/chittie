# Studio mode on Windows (redirected port → print-agent)

Windows has no CUPS, so register a **redirected printer port** that pipes job bytes into a
program — point that program at the agent's `/print-raw`. The proven tool is **RedMon** (GPL).

## Steps
1. Install **RedMon** (Redirection Port Monitor).
2. **Printers & scanners → Add printer → "The printer I want isn't listed" → Add a local printer.**
3. **Create a new port → Redirected Port (RPT:)** → name it `chittie`.
4. Choose a **Generic / Text Only** driver (no driver mangling — raw bytes pass through).
5. Configure the `chittie` port → **Redirect to program**:
   ```
   curl.exe -s -X POST http://127.0.0.1:8930/print-raw --data-binary @- -H "content-type: application/octet-stream"
   ```
   (curl ships with Windows 10+; add `-H "x-agent-token: <TOKEN>"` if the agent uses one.)
6. Name the printer **Chittie**. Printing to it now streams raw ESC/POS/TSPL to the agent.

## Notes
- Use a **Generic/Text-Only** driver so Windows doesn't add its own PCL/GDI bytes — the agent
  expects raw ESC/POS or TSPL.
- A custom port-monitor DLL is the no-dependency alternative to RedMon, but RedMon is the fast path.
- The agent must be running on `:8930` (the Chittie Companion or the headless `chittie-print-agent`).
