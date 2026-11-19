// Neon Coast Cover Studio — hand-in program.
// Node 22, standard library only: copies app/ and screenshots/ from this
// repository into the output folder and writes dossier.json with the
// vendored vendor/makefun-app.ts library. Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output. Running it twice writes the
// same bytes both times: the copies are byte copies and buildDossier is
// deterministic, so nothing here stamps a time or a random value.

import { cpSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = process.env.MAKEFUN_OUTPUT_DIR
  ? resolve(process.env.MAKEFUN_OUTPUT_DIR)
  : '/output';

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
};

function copyTree(name) {
  const from = join(repoRoot, name);
  const to = join(outDir, name);
  cpSync(from, to, { recursive: true, dereference: false });
  return from;
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
copyTree('app');
copyTree('screenshots');

const dossier = buildDossier(outDir, caps);
writeFileSync(join(outDir, 'dossier.json'), dossier);

const appBytes = statSync(join(outDir, 'app')).size;
console.log(`handed in: app/ + screenshots/ -> ${outDir}`);
console.log(`dossier.json: ${dossier.length} bytes (app dir entry: ${appBytes} bytes)`);
