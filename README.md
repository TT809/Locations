# Landkreisplaner Lokales

Dieses Repo ist fuer ein statisches Vercel-Deployment vorbereitet.

## Was Vercel baut

- `npm run build`
- Build-Skript: `scripts/build-lokales-pages.mjs`
- Output-Ordner: `public`

Beim Build werden automatisch erzeugt oder aktualisiert:

- `public/index.html` als Weiterleitung auf `/lokales/`
- `public/lokales/index.html`
- `public/lokales/<slug>/index.html`
- `public/sitemap.xml`
- `public/robots.txt`

Google-Verification-Dateien im Repo-Root wie `google*.html` werden beim Build nach `public/` kopiert.

## Deployment mit Vercel

1. Diesen Ordner in ein GitHub-Repository pushen.
2. Das Repo in Vercel importieren.
3. Optional in Vercel unter `Settings > Environment Variables` `SITE_URL` setzen.

Empfohlen fuer Production:

- `SITE_URL=https://deine-domain.de`

Wenn `SITE_URL` nicht gesetzt ist, verwendet der Build nacheinander:

- `VERCEL_PROJECT_PRODUCTION_URL`
- `VERCEL_URL`
- als Fallback `https://landkreisplaner.de`

## Inhalte pflegen

- Lokale: `public/lokales/data/locations.json`
- Generator: `scripts/build-lokales-pages.mjs`
- Liste: `public/lokales/js/lokales-list.js`
- Detailseite-Interaktionen: `public/lokales/js/lokales-detail.js`
- Styling: `public/lokales/css/lokales.css`

## Lokal neu bauen

```bash
npm run build
```
