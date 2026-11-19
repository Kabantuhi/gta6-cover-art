# Neon Coast — Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Kabantuhi/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Kabantuhi/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

An offline web app that turns any photo and a caption into GTA-style poster
cover art, exported as a PNG to share. Built for the
[Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01) bounty on
[make.fun](https://make.fun).

## What it does

- **Six multi-panel layouts** — four-panel grid, hero + three, full bleed,
  nine-panel grid with a title block, tilted snapshot, and a diagonal duo.
- **Any photo** — upload your own photos or use the two included samples;
  fill every panel with one photo or use several. Click a panel to select it,
  drag to move its photo, scroll to zoom and crop.
- **Caption lettering** — a bold Anton title with outline and shadow, a
  Pacifico neon-script subtitle, a badge ribbon, and a five-star heat meter.
- **Five colour grades** — Sunset, Neon Nights, Vice Pink, Teal Dusk, and
  Golden Hour, plus film grain and a vignette.
- **Fast export** — one click exports the cover as a PNG in 1080 × 1080,
  1080 × 1350, 1920 × 1080, or 1080 × 1920, or all four at once.
- **Undo / redo** for every change.

## Run it

The app is plain static files under `app/` — no build step, no network. Serve
it with any static server, for example:

```sh
node serve.ts
```

then open http://localhost:8080 in desktop Chrome. Your photos never leave
your machine.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/`
to the output directory and writes `dossier.json` with the vendored
`vendor/makefun-app.ts` library.

## Originality

Everything here is original: the lettering uses Anton and Pacifico, both
shipped under the SIL Open Font License (see `app/fonts/`), and the sample
photos were made with an image model. No Rockstar Games logo, artwork,
character, or font appears anywhere.

## License

MIT — see [LICENSE](LICENSE).
