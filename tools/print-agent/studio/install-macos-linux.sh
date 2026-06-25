#!/bin/sh
# Register "Chittie" as a virtual printer (raw CUPS queue) whose jobs forward to the
# local print-agent. Run with the agent already running on :8930.
#   sh install-macos-linux.sh            # install
#   sh install-macos-linux.sh uninstall  # remove
set -eu

# macOS keeps backends in /usr/libexec/cups/backend; most Linux in /usr/lib/cups/backend.
BACKEND_DIR=/usr/libexec/cups/backend
[ -d "$BACKEND_DIR" ] || BACKEND_DIR=/usr/lib/cups/backend
DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "${1:-}" = "uninstall" ]; then
  sudo lpadmin -x Chittie 2>/dev/null || true
  sudo rm -f "$BACKEND_DIR/chittie"
  echo "Removed the Chittie printer + backend."
  exit 0
fi

# CUPS requires backends owned by root and not world-writable (0700/0500).
sudo install -m 0700 -o root "$DIR/chittie-backend" "$BACKEND_DIR/chittie"
# Raw queue: bytes pass through untouched (no driver/filters) — correct for ESC/POS/TSPL.
sudo lpadmin -p Chittie -E -v chittie:/virtual -m raw
echo "Installed. 'Chittie' is now a printer; raw jobs POST to the agent on :8930."
echo "Test:  printf '\\x1b@Hello\\n\\n\\n' | lp -d Chittie -o raw"
