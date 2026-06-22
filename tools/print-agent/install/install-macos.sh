#!/usr/bin/env bash
# Install the Chittie print agent as a per-user LaunchAgent (auto-start at login,
# auto-restart on crash). Run once on the POS terminal.
#
#   ./install-macos.sh [path-to-binary]
#   PRINT_AGENT_TOKEN=secret ./install-macos.sh ./chittie-print-agent
#
# Uninstall: launchctl unload "$HOME/Library/LaunchAgents/dev.angadie.chittie-print-agent.plist" \
#            && rm "$HOME/Library/LaunchAgents/dev.angadie.chittie-print-agent.plist"
set -euo pipefail

BIN="${1:-$(pwd)/chittie-print-agent}"
TOKEN="${PRINT_AGENT_TOKEN:-}"
ORIGIN="${PRINT_AGENT_ALLOW_ORIGIN:-*}"
LABEL="dev.angadie.chittie-print-agent"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DEST="$HOME/Library/Application Support/ChittiePrintAgent"

[ -f "$BIN" ] || { echo "binary not found: $BIN" >&2; exit 1; }

mkdir -p "$DEST" "$HOME/Library/LaunchAgents"
cp "$BIN" "$DEST/chittie-print-agent"
chmod +x "$DEST/chittie-print-agent"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$DEST/chittie-print-agent</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>EnvironmentVariables</key><dict>
    <key>PRINT_AGENT_TOKEN</key><string>$TOKEN</string>
    <key>PRINT_AGENT_ALLOW_ORIGIN</key><string>$ORIGIN</string>
  </dict>
  <key>StandardOutPath</key><string>$DEST/agent.log</string>
  <key>StandardErrorPath</key><string>$DEST/agent.log</string>
</dict></plist>
PLIST

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Chittie print agent installed + started (auto-starts at login)."
echo "Logs: $DEST/agent.log"
