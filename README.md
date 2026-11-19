# Neon Coast Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Kabantuhi/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Kabantuhi/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

An offline web app that turns your photos and a caption into GTA-style
multi-panel poster art, ready to share as a PNG. Built for the
[Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01) bounty on
[make.fun](https://make.fun).

## What it makes

- **Six multi-panel layouts** — a four-panel grid, a hero panel with three
  beside it, one full-bleed photo, a nine-panel grid with a title block in
  the middle, three tilted snapshots, and a diagonal duo.
- **Your photos, your crop** — drop in your own pictures or use the two
  included samples. One photo can fill every panel, or each panel can hold
  a different one. Click a panel to pick it, drag to slide its photo around,
  scroll to zoom in and crop.
- **Big caption lettering** — a bold Anton title with an outline and a drop
  shadow, a Pacifico neon-script subtitle, a diagonal badge ribbon, and a
  five-star heat meter you can tap.
- **Five colour grades** — Sunset, Neon Nights, Vice Pink, Teal Dusk, and
  Golden Hour, with film grain and a vignette on top.
- **One-click export** — save the cover as a PNG at 1080 × 1080, 1080 × 1350,
  1920 × 1080, or 1080 × 1920, or grab all four sizes at once.
- **Undo / redo** — every change can be stepped back and forward again.

## Run it

The app is plain static files under `app/` — no build step and no network.
Serve the folder with any static server, for example:

```sh
node serve.ts
```

then open http://localhost:8080 in desktop Chrome. Your photos stay on your
own machine; nothing is uploaded anywhere.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/`
into the output folder and writes `dossier.json` with the vendored
`vendor/makefun-app.ts` library.

## Originality

Nothing here comes from Rockstar Games: no logo, no artwork, no game font.
The lettering uses Anton and Pacifico, both shipped under the SIL Open Font
License (see `app/fonts/`), and the sample photos were made with an image
model for this project.

## License

MIT — see [LICENSE](LICENSE).
