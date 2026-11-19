// Neon Coast Cover Studio — screenshot driver.
// Node 22, standard library only. Serves app/ with serve.ts, drives the
// cached headless Chromium over raw CDP (no dependencies), captures the 4
// shots from shots.json into screenshots/, verifies one real PNG export and
// asserts the app makes no network request. Run from the repo root:
//   node shots.mjs
// Exit code 0 only when every shot is written within the size cap, the
// export is a valid PNG of the right size, and no external URL was fetched.

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = dirname(fileURLToPath(import.meta.url));
const SHOTS = JSON.parse(readFileSync(join(REPO, 'shots.json'), 'utf8'));
const CHROME = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';
const SERVER_PORT = 8091;
const CDP_PORT = 9333;
const MAX_SHOT_BYTES = 262144;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(label, fn, timeoutMs = 30000) {
  const start = Date.now();
  for (;;) {
    try {
      const out = await fn();
      if (out) return out;
    } catch { /* keep waiting */ }
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for ' + label);
    await sleep(250);
  }
}

// Minimal CDP client over the platform WebSocket.
class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.requests = [];
    this.opened = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error('CDP ' + JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method === 'Network.requestWillBeSent') {
        this.requests.push(msg.params.request.url);
      }
    };
  }

  async call(method, params = {}) {
    await this.opened;
    const id = this.nextId++;
    const done = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.ws.send(JSON.stringify({ id, method, params }));
    return done;
  }

  async eval(expression) {
    const r = await this.call('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error('page threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result ? r.result.value : undefined;
  }

  close() { try { this.ws.close(); } catch { /* already gone */ } }
}

async function httpJson(url, method = 'GET') {
  const res = await fetch(url, { method });
  if (!res.ok) throw new Error(method + ' ' + url + ' -> ' + res.status);
  return res.json();
}

function pngSize(buf) {
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 33 || !magic.every((b, i) => buf[i] === b)) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function main() {
  const server = spawn('node', ['serve.ts', '--port', String(SERVER_PORT)], { cwd: REPO, stdio: 'ignore' });
  const chrome = spawn(CHROME, [
    '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-extensions',
    '--user-data-dir=/tmp/cover-shots-r3-profile',
    '--remote-debugging-port=' + CDP_PORT, 'about:blank',
  ], { stdio: 'ignore' });

  try {
    await waitFor('server', async () => {
      const r = await fetch('http://127.0.0.1:' + SERVER_PORT + '/index.html');
      return r.ok;
    });
    await waitFor('chrome', async () => httpJson('http://127.0.0.1:' + CDP_PORT + '/json/version'));

    let exportChecked = false;
    for (const shot of SHOTS) {
      const url = 'http://127.0.0.1:' + SERVER_PORT + '/index.html' + shot.query;
      let target;
      try {
        target = await httpJson('http://127.0.0.1:' + CDP_PORT + '/json/new?' + encodeURIComponent(url), 'PUT');
      } catch {
        target = await httpJson('http://127.0.0.1:' + CDP_PORT + '/json/new?' + encodeURIComponent(url), 'GET');
      }
      const cdp = new Cdp(target.webSocketDebuggerUrl);
      try {
        await cdp.call('Page.enable');
        await cdp.call('Network.enable');
        await cdp.call('Emulation.setDeviceMetricsOverride', {
          width: shot.w, height: shot.h, deviceScaleFactor: 1, mobile: false,
        });
        await cdp.call('Page.navigate', { url });
        await waitFor('app ready for ' + shot.name, async () => {
          const state = await cdp.eval('window.__coverStudio && (window.__coverStudio.error ? "ERR:"+window.__coverStudio.error : window.__coverStudio.ready)');
          if (typeof state === 'string' && state.startsWith('ERR:')) throw new Error(state);
          return state === true;
        }, 30000);
        await sleep(400); // let the grade wash and grain settle

        if (!exportChecked && shot.query.includes('shot=cover')) {
          const dataUrl = await cdp.eval("window.__coverStudio.exportDataURL('1080x1080')");
          const b64 = String(dataUrl).split(',')[1] || '';
          const png = Buffer.from(b64, 'base64');
          const size = pngSize(png);
          if (!size || size.w !== 1080 || size.h !== 1080) {
            throw new Error('export check failed: not a 1080x1080 PNG (got ' + JSON.stringify(size) + ')');
          }
          console.log('export verified: 1080x1080 PNG, ' + png.length + ' bytes');
          exportChecked = true;
        }

        let quality = 80;
        let file;
        for (let attempt = 0; attempt < 2; attempt++) {
          const shotRes = await cdp.call('Page.captureScreenshot', { format: 'jpeg', quality });
          file = Buffer.from(shotRes.data, 'base64');
          if (file.length <= MAX_SHOT_BYTES) break;
          quality = 62;
        }
        if (file.length > MAX_SHOT_BYTES) throw new Error(shot.name + ' is ' + file.length + ' bytes, over the 256 KiB cap');
        writeFileSync(join(REPO, 'screenshots', shot.name), file);
        console.log(shot.name + ': ' + shot.w + 'x' + shot.h + ', ' + file.length + ' bytes');

        const external = cdp.requests.filter((u) => !u.startsWith('http://127.0.0.1') && !u.startsWith('data:') && !u.startsWith('about:'));
        if (external.length) throw new Error('network request outside the app server: ' + external[0]);
      } finally {
        cdp.close();
        try { await httpJson('http://127.0.0.1:' + CDP_PORT + '/json/close/' + target.id, 'GET'); } catch { /* already closed */ }
      }
    }
    if (!exportChecked) throw new Error('no cover shot ran, so the export was never verified');
    console.log('all shots done, no network requests');
  } finally {
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error('shots failed:', err.message);
  process.exit(1);
});
