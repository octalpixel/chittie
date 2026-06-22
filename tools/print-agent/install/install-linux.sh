#!/usr/bin/env bash
# Install the Chittie print agent as a systemd --user service (auto-start,
# auto-restart). Run once on the POS terminal.
#
#   ./install-linux.sh [path-to-binary]
#   PRINT_AGENT_TOKEN=secret ./install-linux.sh ./chittie-print-agent
#
# Uninstall: systemctl --user disable --now chittie-print-agent \
#            && rm ~/.config/systemd/user/chittie-print-agent.service
set -euo pipefail

BIN="${1:-$(pwd)/chittie-print-agent}"
TOKEN="${PRINT_AGENT_TOKEN:-}"
ORIGIN="${PRINT_AGENT_ALLOW_ORIGIN:-*}"
DEST="$HOME/.local/bin"
UNIT_DIR="$HOME/.config/systemd/user"

[ -f "$BIN" ] || { echo "binary not found: $BIN" >&2; exit 1; }

mkdir -p "$DEST" "$UNIT_DIR"
install -m755 "$BIN" "$DEST/chittie-print-agent"

cat > "$UNIT_DIR/chittie-print-agent.service" <<UNIT
[Unit]
Description=Chittie Print Agent
After=network.target

[Service]
ExecStart=$DEST/chittie-print-agent
Restart=always
RestartSec=2
Environment=PRINT_AGENT_TOKEN=$TOKEN
Environment=PRINT_AGENT_ALLOW_ORIGIN=$ORIGIN

[Install]
WantedBy=default.target
UNIT

systemctl --user daemon-reload
systemctl --user enable --now chittie-print-agent
# Keep it running when no user is logged in (kiosk terminals).
loginctl enable-linger "$USER" 2>/dev/null || true
echo "Chittie print agent installed + started."
echo "Logs: journalctl --user -u chittie-print-agent -f"
