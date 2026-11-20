// Neon Coast Cover Studio — make.fun entry builder (Node 22, stdlib only).
//
// What it does, in order:
//   1. Copies the whole offline app (app/) into the output directory.
//   2. Copies the four screenshots into output/screenshots/.
//   3. Builds the entry dossier from the output tree and writes dossier.json.
//
// The grader runs this with the repo mounted read-only and /output as a
// bind mount, so it must never delete or rewrite anything in place:
// only mkdirSync (recursive) and cpSync are used — nothing that removes files.

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-app.ts';

const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The app itself: every static file under app/ (page, scripts, styles,
// fonts, sample photos) goes to the output verbatim.
mkdirSync(join(out, 'app'), { recursive: true });
cpSync('app', join(out, 'app'), { recursive: true });

// The screenshots: the first by name is the cover.
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync('screenshots', join(out, 'screenshots'), { recursive: true });

// The dossier: the scorer rebuilds this exact file from the output tree,
// so these caps must match the bounty's gate.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

console.log(`Neon Coast Cover Studio built into ${out}`);
