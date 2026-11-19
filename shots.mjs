// Screenshot driver for Neon Coast Cover Studio (Node 22, standard library
// only). Serves app/, drives headless Chrome over its DevTools protocol,
// and captures the shots listed in shots.json into screenshots/.
//   node shots.mjs
// It also calls the app's export hook and checks the PNG bytes it returns,
// so a real export is verified, not just the preview.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8080;
const CDP_PORT = 9223;

const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  throw new Error('timed out waiting for ' + url);
}

// JPEG dimensions from the SOF0/SOF2 marker, no image library needed.
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xc0 || marker === 0xc2) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) throw new Error('page error: ' + JSON.stringify(res.exceptionDetails));
    return res.result ? res.result.value : undefined;
  }

  async waitReady(timeoutMs = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        if (await this.evaluate('window.__ready === true')) return true;
      } catch {
        // page still loading
      }
      await sleep(300);
    }
    throw new Error('app did not become ready in time');
  }

  async screenshot(file, quality = 85) {
    const shot = await this.send('Page.captureScreenshot', { format: 'jpeg', quality });
    const buf = Buffer.from(shot.data, 'base64');
    writeFileSync(file, buf);
    return buf;
  }

  close() {
    try { this.ws.close(); } catch { /* already closed */ }
  }
}

async function main() {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: here, stdio: 'pipe' });
  let serverOut = '';
  server.stdout.on('data', (d) => { serverOut += String(d); });
  server.stderr.on('data', (d) => { serverOut += String(d); });
  try {
    await waitFor(`http://127.0.0.1:${PORT}/index.html`);
    console.log('server up:', serverOut.trim().split('\n').pop());

    const chrome = spawn(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--remote-debugging-port=${CDP_PORT}`,
      '--user-data-dir=/tmp/chrome-profile-shots',
      'about:blank',
    ], { stdio: 'ignore' });
    try {
      const targets = await waitFor(`http://127.0.0.1:${CDP_PORT}/json/list`).then(async () => {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        return res.json();
      });
      const page = targets.find((t) => t.type === 'page');
      if (!page) throw new Error('no page target in chrome');
      const cdp = new Cdp(page.webSocketDebuggerUrl);
      await cdp.ready;
      await cdp.send('Page.enable');
      await cdp.send('Runtime.enable');

      // Verify a real export first: ask the app for PNG bytes and check them.
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?shot=editor` });
      await cdp.waitReady();
      for (const [w, h] of [[1080, 1080], [1920, 1080]]) {
        const dataUrl = await cdp.evaluate(`window.__coverStudio.exportDataURL(${w},${h})`);
        if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
          throw new Error(`export ${w}x${h} did not return a PNG data URL`);
        }
        const bytes = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
        const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
        if (!bytes.subarray(0, 4).equals(pngMagic)) throw new Error(`export ${w}x${h} is not a PNG`);
        console.log(`export OK: ${w}x${h} PNG, ${bytes.length} bytes`);
      }

      mkdirSync(join(here, 'screenshots'), { recursive: true });
      for (const shot of shots) {
        await cdp.send('Emulation.setDeviceMetricsOverride', { width: shot.w, height: shot.h, deviceScaleFactor: 1, mobile: false });
        await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${shot.query}` });
        await cdp.waitReady();
        await sleep(400); // let the canvas paint settle
        const file = join(here, 'screenshots', shot.name);
        const buf = await cdp.screenshot(file);
        const size = jpegSize(buf);
        const okSize = buf.length <= 262144;
        const okDim = size && size.w === shot.w && size.h === shot.h;
        console.log(`${shot.name}: ${buf.length} bytes (<=256KiB: ${okSize}), ${size ? size.w + 'x' + size.h : 'unknown size'} (expected ${shot.w}x${shot.h}: ${okDim})`);
        if (!okSize || !okDim) throw new Error(`shot ${shot.name} failed its checks`);
      }
      cdp.close();
      console.log('all shots done');
    } finally {
      chrome.kill('SIGKILL');
    }
  } finally {
    server.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error('shots failed:', err.message);
  process.exit(1);
});
