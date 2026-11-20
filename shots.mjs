// Neon Coast Cover Studio — screenshot driver (round 5 build).
// Serves the app with serve.ts, drives headless Chrome over CDP with
// Node's built-in WebSocket, and captures the four shots from shots.json.
// No third-party packages: node:child_process, node:fs, node:path only.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)));
const shots = JSON.parse(readFileSync(join(repo, 'shots.json'), 'utf8'));
// The Meta Chromium build refuses to start here (it demands a Hatch WebGL
// domain policy), so default to Playwright's headless shell, which runs.
const CHROME = process.env.CHROME_BIN || join(homedir(), '.cache', 'ms-playwright', 'chromium_headless_shell-1255', 'chrome-headless-shell-linux64', 'chrome-headless-shell');
const PORT = 8901;
const DEBUG_PORT = 9333;

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function waitFor(url, timeoutMs) {
  var deadline = Date.now() + (timeoutMs || 20000);
  while (Date.now() < deadline) {
    try {
      var r = await fetch(url);
      if (r.ok) return true;
    } catch (e) { /* server not up yet */ }
    await sleep(250);
  }
  throw new Error('timed out waiting for ' + url);
}

// Minimal CDP client over Node's built-in WebSocket.
function CDP(wsUrl) {
  this.ws = new WebSocket(wsUrl);
  this.nextId = 0;
  this.pending = new Map();
  var self = this;
  this.ws.onmessage = function (ev) {
    var msg = JSON.parse(ev.data);
    if (!msg.id || !self.pending.has(msg.id)) return;
    var p = self.pending.get(msg.id);
    self.pending.delete(msg.id);
    if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
    else p.resolve(msg.result);
  };
}
CDP.prototype.ready = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    self.ws.onopen = resolve;
    self.ws.onerror = reject;
  });
};
CDP.prototype.send = function (method, params) {
  var self = this;
  var id = ++self.nextId;
  return new Promise(function (resolve, reject) {
    self.pending.set(id, { resolve: resolve, reject: reject });
    self.ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
  });
};
CDP.prototype.eval = async function (expression) {
  var r = await this.send('Runtime.evaluate', { expression: expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('page JS error: ' + JSON.stringify(r.exceptionDetails));
  return r.result ? r.result.value : undefined;
};
CDP.prototype.close = function () { this.ws.close(); };

async function openTarget(url) {
  var endpoint = 'http://127.0.0.1:' + DEBUG_PORT + '/json/new?' + url;
  var r = await fetch(endpoint, { method: 'PUT' });
  if (!r.ok) r = await fetch(endpoint);
  var t = await r.json();
  if (!t.webSocketDebuggerUrl) throw new Error('could not create target for ' + url);
  return t;
}

async function captureAll() {
  var server = spawn(process.execPath, ['serve.ts', '--port', String(PORT)], { cwd: repo, stdio: 'ignore' });
  var chrome = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--remote-debugging-port=' + DEBUG_PORT,
    '--user-data-dir=/tmp/neon-coast-shots-profile',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    await waitFor('http://127.0.0.1:' + PORT + '/index.html');
    await waitFor('http://127.0.0.1:' + DEBUG_PORT + '/json/version');
    for (var i = 0; i < shots.length; i++) {
      var shot = shots[i];
      var target = await openTarget('http://127.0.0.1:' + PORT + shot.url);
      var cdp = new CDP(target.webSocketDebuggerUrl);
      await cdp.ready();
      await cdp.send('Page.enable');
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: shot.width,
        height: shot.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      var deadline = Date.now() + 30000;
      var ready = false;
      while (Date.now() < deadline) {
        try { ready = await cdp.eval('window.__shotReady === true'); } catch (e) { /* keep waiting */ }
        if (ready) break;
        await sleep(300);
      }
      if (!ready) throw new Error('shot not ready: ' + shot.file);
      var pic = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
      var buf = Buffer.from(pic.data, 'base64');
      writeFileSync(join(repo, 'screenshots', shot.file), buf);
      console.log(shot.file, buf.length, 'bytes');
      cdp.close();
    }
  } finally {
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
  }
}

captureAll().catch(function (e) {
  console.error(e);
  process.exit(1);
});
