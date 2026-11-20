// Neon Coast Cover Studio — entrypoint for make.fun (round 5 build).
// Copies app/ and screenshots/ into the output directory, then writes
// dossier.json from them with the kit's buildDossier, so the handed-in
// entry is exactly what the scorer reads. Runs with plain `node main.ts`
// (erasable TypeScript, Node 22+): no flags, no build, no install.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const wanted = process.env.MAKEFUN_OUTPUT_DIR ?? 'out';
const outDir = resolve(repoRoot, wanted);
const appDir = join(repoRoot, 'app');
const shotsDir = join(repoRoot, 'screenshots');

if (!existsSync(appDir)) throw new Error('app/ is missing in ' + repoRoot);
if (!existsSync(shotsDir)) throw new Error('screenshots/ is missing in ' + repoRoot);

// NOTE: never delete outDir here. In the grader /output is a bind mount,
// and removing the mount point itself fails (EBUSY/EACCES — force only
// skips ENOENT). Round 4 died exactly on that rmSync. The grader always
// hands us an empty output dir, so just making sure it exists is enough —
// cpSync then fills it, and the dossier is written on top.
mkdirSync(outDir, { recursive: true });
cpSync(appDir, join(outDir, 'app'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
const dossierPath = join(outDir, 'dossier.json');
writeFileSync(dossierPath, dossier);

// Read it back and check it parses, so a bad dossier fails loudly here
// instead of being handed in silently.
const check = JSON.parse(readFileSync(dossierPath, 'utf8'));
if (typeof check.text !== 'string' || !check.text.includes('## App')) {
  throw new Error('dossier.json is missing the ## App text block');
}
console.log('wrote ' + dossierPath);
console.log('dossier: ' + dossier.length + ' bytes, ' + check.images.length + ' screenshots, cover #' + check.cover + ', text ' + Buffer.byteLength(check.text) + ' bytes');
