# Neon Coast Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Kabantuhi/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Kabantuhi/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Turn any photo and a caption into GTA-style poster cover art — right in the browser, fully offline. Pick a layout, drop in your photos, grade the colours, and export a print-ready PNG.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. No build step, no install, no network requests — the app, its fonts and its two sample photos are all local files under `app/`.

## What it does

- Six multi-panel layouts: four-panel grid, hero + three, full bleed, nine-panel grid with a title block, tilted polaroids, diagonal duo
- Photo upload plus two built-in sample photos; click a panel to select it, drag to move its photo, scroll to zoom — every panel keeps its own crop
- Anton title with outline and shadow, Pacifico neon subtitle, a five-star heat meter and a "LAUNCH WEEK" ribbon
- Five colour grades (Sunset, Neon Nights, Vice Pink, Teal Dusk, Golden Hour) plus film grain and a vignette
- PNG export at 1080×1080, 1080×1350, 1920×1080 and 1080×1920 — one size or all four at once
- Undo / redo (Ctrl+Z / Ctrl+Y)

## Screenshots

`shots.mjs` retakes the four screenshots with headless Chrome:

```sh
node shots.mjs
```

## Entry

Built for the [GTA 6 Cover Art bounty on make.fun](https://make.fun/bounty/gta6-cover-art-01). The entrypoint is `main.ts`: it copies `app/` and `screenshots/` into the output directory and writes `dossier.json` with the kit's `buildDossier`.

Referral code: c45jj78w
