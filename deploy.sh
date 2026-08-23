#!/usr/bin/env bash
set -euo pipefail

readonly repository="/opt/pi-home/app"
readonly web_root="/var/www/pi-server"
readonly state_directory="/var/lib/pi-home"
readonly deployment_marker="${state_directory}/last-deployed-sha"
readonly deployment_lock="/run/lock/pi-home-deploy.lock"

if (( EUID != 0 )); then
    echo "Run this script with sudo." >&2
    exit 1
fi

exec 9>"$deployment_lock"
if ! flock --nonblock 9; then
    echo "Another Pi Home deployment is already running; skipping." >&2
    exit 0
fi

if [[ ! -d "$repository" ]]; then
    echo "Repository not found: $repository" >&2
    exit 1
fi

current_branch="$(runuser -u pi-home -- git -C "$repository" branch --show-current)"
if [[ "$current_branch" == "main" ]]; then
    echo "Moving the Pi Home checkout to the ready-to-run deploy branch..."
    runuser -u pi-home -- git -C "$repository" fetch origin deploy
    runuser -u pi-home -- git -C "$repository" switch --create deploy --track origin/deploy
elif [[ "$current_branch" != "deploy" ]]; then
    echo "Expected the repository to be on deploy (or legacy main), found: $current_branch" >&2
    exit 1
fi

echo "Pulling ready-to-run dashboard and server configuration..."
runuser -u pi-home -- git -C "$repository" pull --ff-only origin deploy
install -d -m 755 -o pi-home -g pi-home "$state_directory"

echo "Publishing dashboard..."
install -d -m 755 -o root -g root "$web_root"
install -m 644 "${repository}/site/index.html" "${web_root}/index.html"
install -m 644 "${repository}/site/home.css" "${web_root}/home.css"
install -m 644 "${repository}/site/home.js" "${web_root}/home.js"
install -m 644 "${repository}/site/manifest.webmanifest" "${web_root}/manifest.webmanifest"
install -m 644 "${repository}/site/sw.js" "${web_root}/sw.js"
install -m 644 "${repository}/site/icon.svg" "${web_root}/icon.svg"
install -m 644 "${repository}/site/icon-192.png" "${web_root}/icon-192.png"
install -m 644 "${repository}/site/icon-512.png" "${web_root}/icon-512.png"

echo "Installing shared Nginx configuration..."
install -m 644 "${repository}/deploy/nginx/pi-server" /etc/nginx/sites-available/pi-server
ln -sfn /etc/nginx/sites-available/pi-server /etc/nginx/sites-enabled/pi-server
if [[ -L /etc/nginx/sites-enabled/pi-todo ]]; then
    unlink /etc/nginx/sites-enabled/pi-todo
fi

nginx -t
systemctl restart nginx

echo "Refreshing update timer..."
install -m 644 "${repository}/deploy/systemd/pi-home-update.service" /etc/systemd/system/
install -m 644 "${repository}/deploy/systemd/pi-home-update.timer" /etc/systemd/system/
install -m 644 "${repository}/deploy/systemd/pi-home-status.service" /etc/systemd/system/
install -m 644 "${repository}/deploy/systemd/pi-home-status.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now pi-home-update.timer

deployed_sha="$(runuser -u pi-home -- git -C "$repository" rev-parse HEAD)"
marker_temp="${deployment_marker}.tmp"
printf '%s\n' "$deployed_sha" >"$marker_temp"
chmod 644 "$marker_temp"
mv -- "$marker_temp" "$deployment_marker"
systemctl enable --now pi-home-status.timer
systemctl start pi-home-status.service
echo "Dashboard and shared routing deployed successfully."
