#!/usr/bin/env bash
# Buddy Lamp client installer for a Raspberry Pi.
# Installs dependencies, asks for your settings (writes client/.env), and sets the lamp
# to start by itself on every boot. Safe to run again.
#
#   cd buddy-lamp/client && ./install.sh

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE="buddy-lamp-client"
RUN_USER="${SUDO_USER:-$USER}"

if [ "$(id -u)" -eq 0 ] && [ -z "${SUDO_USER:-}" ]; then
  echo "Run this as your normal user (it asks for sudo when needed), not as root." >&2
  exit 1
fi

echo "==> Checking dependencies"
if ! python3 -c "import requests, RPi.GPIO" 2>/dev/null; then
  sudo apt-get update
  sudo apt-get install -y python3 python3-requests python3-rpi.gpio
fi

ask() { # ask "Prompt" default -> value
  local reply
  read -r -p "$1${2:+ [$2]}: " reply
  echo "${reply:-$2}"
}

if [ -f "$DIR/.env" ]; then
  echo "==> Keeping your existing $DIR/.env (delete it and re-run to change settings)"
else
  echo "==> Lamp settings (see client/.env.example for what these mean)"
  url="$(ask 'Server URL (ending in /messages)' '')"
  family="$(ask 'Family name (same on every lamp in your group, a-z 0-9 - _)' '')"
  read -r -s -p "Shared secret (same as the server's BUDDY_LAMP_SECRET): " secret
  echo
  name="$(ask 'Your name (max 32 characters)' '')"
  color="$(ask 'Your color (red, blue or green)' 'red')"

  umask 077
  cat > "$DIR/.env" <<EOF
BUDDY_LAMP_URL=$url
BUDDY_LAMP_FAMILY=$family
BUDDY_LAMP_SECRET=$secret
BUDDY_LAMP_NAME=$name
BUDDY_LAMP_COLOR=$color
EOF
  if [ "$color" = "blue" ]; then
    printf '# Blue lamp: the "yours" LED is the blue one\nBUDDY_LAMP_MINE_LED_PIN=17\nBUDDY_LAMP_OTHER_LED_PIN=3\n' >> "$DIR/.env"
  fi
fi

echo "==> Checking settings"
(cd "$DIR" && python3 -c "from config import load_config; load_config(); print('settings OK')")

echo "==> Installing the $SERVICE service (starts on boot)"
sudo usermod -aG gpio "$RUN_USER" || true
sudo tee "/etc/systemd/system/$SERVICE.service" > /dev/null <<EOF
[Unit]
Description=Buddy Lamp client
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$RUN_USER
SupplementaryGroups=gpio
WorkingDirectory=$DIR
ExecStart=/usr/bin/python3 -u $DIR/main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE"
sudo systemctl restart "$SERVICE"

echo
echo "Done. The lamp flashes each LED once, then runs. It will start by itself after a reboot."
echo "  Logs:    journalctl -u $SERVICE -f"
echo "  Status:  systemctl status $SERVICE"
echo "  Remove:  sudo systemctl disable --now $SERVICE"
