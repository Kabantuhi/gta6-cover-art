// shots.mjs — dev-only screenshot script for Neon Coast Cover Studio.
// NOT part of the app and NOT copied to /output. Run: `node shots.mjs`
// Serves app/ over local HTTP, opens it in Playwright Chromium, and saves
// four JPEG screenshots into screenshots/ (each <= 256 KiB, long side <= 1280).

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('/tmp/shot-tools/node_modules/playwright');

const ROOT = resolve(fileURLToPath(new URL('./app', import.meta.url)));
const SHOTS_DIR = resolve(fileURLToPath(new URL('./screenshots', import.meta.url)));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

function serve() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = resolve(join(ROOT, pathname.replace(/^\/+/, '')));
      if (!file.startsWith(ROOT)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      const data = await readFile(file);
      res.writeHead(200, {
        'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
        'content-length': data.length,
      });
      res.end(data);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolveListen) => {
    server.listen(0, '127.0.0.1', () => resolveListen(server));
  });
}

// file, page URL suffix, viewport, what to capture
const SHOTS = [
  {
    file: '1-cover.jpg',
    url: '/?shot=cover&photo=pier&caption=Sunset%20Heist&accent=Vice%20City%20nights&size=wide',
    viewport: { width: 1280, height: 720 },
    target: '#cover',
  },
  {
    file: '2-editor.jpg',
    url: '/?shot=editor&photo=boulevard&caption=Boulevard%20Queen&accent=Neon%20nights&size=wide',
    viewport: { width: 1280, height: 720 },
    target: null, // whole viewport: the editor UI must be visible
  },
  {
    file: '3-cover.jpg',
    url: '/?shot=cover&photo=boulevard&caption=Boulevard%20Queen&accent=Neon%20nights&size=square',
    viewport: { width: 1080, height: 1080 },
    target: '#cover',
  },
  {
    file: '4-cover.jpg',
    url: '/?shot=cover&photo=pier&caption=Sunset%20Heist&accent=Vice%20City%20nights&size=portrait',
    viewport: { width: 1024, height: 1280 },
    target: '#cover',
  },
];

async function takeShot(browser, base, shot) {
  const page = await browser.newPage({ viewport: shot.viewport });
  await page.goto(base + shot.url, { waitUntil: 'load' });
  // Wait for the fonts and the first cover render to finish.
  await page.waitForFunction(() => window.__coverReady === true, null, { timeout: 15000 });
  await page.waitForTimeout(400);
  let quality = 82;
  for (;;) {
    const path = join(SHOTS_DIR, shot.file);
    if (shot.target) {
      await page.locator(shot.target).screenshot({ path, type: 'jpeg', quality });
    } else {
      await page.screenshot({ path, type: 'jpeg', quality });
    }
    const { size } = await import('node:fs').then((fs) => fs.promises.stat(path));
    if (size <= 262144 || quality <= 55) {
      console.log(`${shot.file}: ${size} bytes (quality ${quality})`);
      break;
    }
    quality -= 8;
    console.log(`${shot.file}: ${size} bytes over cap, retrying at quality ${quality}`);
  }
  await page.close();
}

const server = await serve();
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
try {
  for (const shot of SHOTS) await takeShot(browser, base, shot);
} finally {
  await browser.close();
  server.close();
}
console.log('All 4 screenshots done.');
