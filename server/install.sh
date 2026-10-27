#!/usr/bin/env bash
# Buddy Lamp server installer (Raspberry Pi or any Debian-style Linux box).
# Installs dependencies, creates server/.env with a random secret, and sets the server
# to start by itself on every boot. Safe to run again.
#
#   cd buddy-lamp/server && ./install.sh

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE="buddy-lamp-server"
RUN_USER="${SUDO_USER:-$USER}"

if [ "$(id -u)" -eq 0 ] && [ -z "${SUDO_USER:-}" ]; then
  echo "Run this as your normal user (it asks for sudo when needed), not as root." >&2
  exit 1
fi

echo "==> Checking Node.js"
if ! command -v node > /dev/null || ! command -v npm > /dev/null; then
  sudo apt-get update
  sudo apt-get install -y nodejs npm
fi
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if (a<18||(a===18&&b<2)) { console.error("Node 18.2 or newer is required, found " + process.version); process.exit(1); }'

echo "==> Installing packages"
(cd "$DIR" && npm install --omit=dev)

if [ -f "$DIR/.env" ]; then
  echo "==> Keeping your existing $DIR/.env"
else
  echo "==> Creating $DIR/.env with a random secret"
  secret="$(node -e 'console.log(require("crypto").randomBytes(16).toString("hex"))')"
  umask 077
  printf 'BUDDY_LAMP_SECRET=%s\nPORT=3000\n' "$secret" > "$DIR/.env"
  echo
  echo "  Your shared secret (put this in every lamp's client/.env):"
  echo "  $secret"
  echo
fi

echo "==> Installing the $SERVICE service (starts on boot)"
sudo tee "/etc/systemd/system/$SERVICE.service" > /dev/null <<EOF
[Unit]
Description=Buddy Lamp server
After=network.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$DIR
ExecStart=$(command -v node) index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE"
sudo systemctl restart "$SERVICE"

echo "Done. The server will start by itself after a reboot."
echo "  Logs:    journalctl -u $SERVICE -f"
echo "  Status:  systemctl status $SERVICE"
echo "  Check:   curl http://localhost:3000/health"
echo "  Remove:  sudo systemctl disable --now $SERVICE"
echo "Remember: forward the port on your router if lamps connect from outside your network."
