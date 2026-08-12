# Pi Home

Static dashboard and shared Nginx entrance for the private Raspberry Pi apps.

It serves the dashboard at `/`, Todo at `/todo/`, and Flashcards at
`/flashcards/`. This repository owns the shared Nginx server block; individual
apps own their services and static subdirectories.

The dashboard is an installable root-scoped PWA. Its service worker explicitly
ignores application subpaths so each app remains controlled by its own PWA.
