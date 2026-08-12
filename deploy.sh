#!/usr/bin/env bash
set -euo pipefail

readonly repository="/opt/pi-home/app"
readonly web_root="/var/www/pi-server"

if (( EUID != 0 )); then
    echo "Run this script with sudo." >&2
    exit 1
fi

if [[ ! -d "$repository" ]]; then
    echo "Repository not found: $repository" >&2
    exit 1
fi

echo "Pulling dashboard and server configuration..."
runuser -u pi-home -- git -C "$repository" pull --ff-only origin main

echo "Publishing dashboard..."
install -d -m 755 -o root -g root "$web_root"
install -m 644 "${repository}/site/index.html" "${web_root}/index.html"
install -m 644 "${repository}/site/home.css" "${web_root}/home.css"

echo "Installing shared Nginx configuration..."
install -m 644 "${repository}/deploy/nginx/pi-server" /etc/nginx/sites-available/pi-server
ln -sfn /etc/nginx/sites-available/pi-server /etc/nginx/sites-enabled/pi-server
if [[ -L /etc/nginx/sites-enabled/pi-todo ]]; then
    unlink /etc/nginx/sites-enabled/pi-todo
fi

nginx -t
systemctl restart nginx
echo "Dashboard and shared routing deployed successfully."

