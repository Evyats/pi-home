# Pi Home

Static dashboard and shared Nginx entrance for the private Raspberry Pi apps.

It serves the dashboard at `/`, Todo at `/todo/`, and Flashcards at
`/flashcards/`. This repository owns the shared Nginx server block; individual
apps own their services and static subdirectories.

The dashboard is an installable root-scoped PWA. Its service worker explicitly
ignores application subpaths so each app remains controlled by its own PWA.

## First and later local runs

Pi Home has no dependencies to install. Serve it from the `site` directory:

```powershell
cd site
python -m http.server 5173 --bind 0.0.0.0
```

Open <http://localhost:5173/> on the computer. On a phone connected to the same
Wi-Fi, open `http://<computer-ip>:5173/`. Find the IP with `ipconfig` and allow
Python through Windows Firewall on private networks if prompted.

## Deploy

After pushing changes to `main`, run on the Pi:

```bash
sudo /opt/pi-home/app/deploy.sh
```
