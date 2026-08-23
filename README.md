# Pi Home

Static dashboard and shared Nginx entrance for the private Raspberry Pi apps.

It serves the dashboard at `/`, Todo at `/todo/`, Flashcards at `/flashcards/`,
Geography at `/geography/`, and Gym at `/gym/`. This repository owns the shared Nginx server
block; individual apps own their services and static subdirectories.

The dashboard is an installable root-scoped PWA. Its service worker explicitly
ignores application subpaths so each app remains controlled by its own PWA.
The Manage apps screen controls dashboard order and visibility. Preferences are
stored locally in each browser, so phone and computer layouts can differ.

## First and later local runs

Pi Home has no dependencies to install. Serve it from the `site` directory:

```powershell
cd pi-home\site
python -m http.server 5173 --bind 0.0.0.0
```

Open <http://localhost:5173/> on the computer. On a phone connected to the same
Wi-Fi, open `http://<computer-ip>:5173/`. Find the IP with `ipconfig` and allow
Python through Windows Firewall on private networks if prompted.

## Deploy

Push changes to `main`, then wait for the
[GitHub Actions validation](https://github.com/Evyats/pi-home/actions) to turn
green. The Pi checks the successful `deploy` branch every five minutes and
deploys new versions automatically. Manual deployment remains available with:

```bash
sudo /opt/pi-home/app/deploy.sh
```

The first deployment containing the pipeline and timer must be run manually.
Because older Pi Home installations track `main`, run the command once to pull
this setup and a second time to move the checkout to `deploy` and install the
timer. Inspect it afterward with:

```bash
systemctl list-timers pi-home-update.timer
sudo journalctl -u pi-home-update.service -n 50 --no-pager
```
