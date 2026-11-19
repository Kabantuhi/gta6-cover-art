// Neon Coast Cover Studio — wires the page: layout/grade/size pickers, caption
// editing, per-panel photos with drag-to-move and scroll-to-zoom, undo/redo,
// PNG export in the four post sizes, and the ?shot= scenes for screenshots.
import { drawCover, layoutGeometry, panelCount, LAYOUTS, GRADES, SIZES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('stage');
const statusEl = document.getElementById('status');
const exportSizeEl = document.getElementById('exportSize');

// Photos the app knows: the two free samples plus anything the user uploads.
// Each entry is { key, label, img } — img is a loaded HTMLImageElement.
const photos = [];
let activePanel = 0;

function blankPanel() {
  return { src: null, scale: 1, dx: 0, dy: 0 };
}

const state = {
  layout: 'grid',
  grade: 'sunset',
  size: 'square',
  title: 'Neon Shore',
  subtitle: 'Night Drive',
  badge: 'Launch Week',
  heat: 4,
  panels: [blankPanel(), blankPanel(), blankPanel(), blankPanel()],
};

const history = [];
let historyAt = -1;

function snapshot() {
  return JSON.parse(JSON.stringify(state));
}

function pushHistory() {
  history.length = historyAt + 1;
  history.push(snapshot());
  if (history.length > 60) history.shift();
  historyAt = history.length - 1;
  refreshUndoRedo();
}

function applySnapshot(snap) {
  Object.assign(state, JSON.parse(JSON.stringify(snap)));
  syncPanelsToLayout(false);
  syncControls();
  redraw();
}

function refreshUndoRedo() {
  document.getElementById('undo').disabled = historyAt <= 0;
  document.getElementById('redo').disabled = historyAt >= history.length - 1;
}

function syncPanelsToLayout(keepPhotos = true) {
  const n = panelCount(state.layout);
  const old = state.panels;
  const next = [];
  for (let i = 0; i < n; i++) {
    if (keepPhotos && old[i]) next.push(old[i]);
    else next.push(blankPanel());
  }
  state.panels = next;
  if (activePanel >= n) activePanel = 0;
}

function currentSize() {
  return SIZES.find((s) => s.id === state.size) || SIZES[0];
}

function resolvedImages() {
  return state.panels.map((p) => {
    if (!p.src) return null;
    const found = photos.find((ph) => ph.key === p.src);
    return found ? found.img : null;
  });
}

function redraw() {
  drawCover(canvas, state, resolvedImages());
  exportSizeEl.textContent = currentSize().label;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function addPhoto(key, label, url) {
  if (photos.some((p) => p.key === key)) return photos.find((p) => p.key === key);
  const img = await loadImage(url);
  const entry = { key, label, img };
  photos.push(entry);
  renderLibrary();
  return entry;
}

// ---- controls -------------------------------------------------------------

function buildChoiceButtons(el, items, current, onPick) {
  el.innerHTML = '';
  items.forEach(([id, label, style]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-pressed', String(id === current));
    if (style) b.style.background = style;
    b.addEventListener('click', () => {
      onPick(id);
      el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
    });
    el.appendChild(b);
  });
}

function renderLayoutButtons() {
  buildChoiceButtons(
    document.getElementById('layouts'),
    Object.entries(LAYOUTS).map(([id, l]) => [id, l.name]),
    state.layout,
    (id) => { pushHistory(); state.layout = id; syncPanelsToLayout(true); renderPanelButtons(); redraw(); },
  );
}

function renderGradeButtons() {
  const el = document.getElementById('grades');
  el.innerHTML = '';
  Object.entries(GRADES).forEach(([id, g]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.title = g.name;
    b.setAttribute('aria-label', g.name);
    b.setAttribute('aria-pressed', String(id === state.grade));
    b.style.background = `linear-gradient(135deg, ${g.stops[0]}, ${g.stops[1]} 55%, ${g.stops[2]})`;
    b.addEventListener('click', () => {
      pushHistory();
      state.grade = id;
      el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      redraw();
    });
    el.appendChild(b);
  });
}

function renderSizeButtons() {
  buildChoiceButtons(
    document.getElementById('sizes'),
    SIZES.map((s) => [s.id, s.label]),
    state.size,
    (id) => {
      pushHistory();
      state.size = id;
      const s = currentSize();
      canvas.width = s.w;
      canvas.height = s.h;
      redraw();
    },
  );
}

function renderPanelButtons() {
  buildChoiceButtons(
    document.getElementById('panels'),
    state.panels.map((_, i) => [`p${i}`, `Panel ${i + 1}`]),
    `p${activePanel}`,
    (id) => { activePanel = Number(id.slice(1)); renderLibrary(); },
  );
}

function renderHeatStars() {
  const el = document.getElementById('heatStars');
  el.textContent = '★'.repeat(state.heat) + '☆'.repeat(5 - state.heat);
}

function renderLibrary() {
  const el = document.getElementById('library');
  el.innerHTML = '';
  const selected = state.panels[activePanel]?.src;
  photos.forEach((p) => {
    const img = document.createElement('img');
    img.src = p.img.src;
    img.alt = p.label;
    img.title = p.label;
    img.setAttribute('aria-pressed', String(p.key === selected));
    img.addEventListener('click', () => {
      pushHistory();
      state.panels[activePanel].src = p.key;
      state.panels[activePanel].scale = 1;
      state.panels[activePanel].dx = 0;
      state.panels[activePanel].dy = 0;
      renderLibrary();
      redraw();
    });
    el.appendChild(img);
  });
}

function syncControls() {
  document.getElementById('title').value = state.title;
  document.getElementById('subtitle').value = state.subtitle;
  document.getElementById('badge').value = state.badge;
  renderHeatStars();
  renderLayoutButtons();
  renderGradeButtons();
  renderSizeButtons();
  renderPanelButtons();
  renderLibrary();
  const s = currentSize();
  canvas.width = s.w;
  canvas.height = s.h;
}

// ---- caption inputs --------------------------------------------------------

function bindText(id, key) {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    state[key] = el.value;
    redraw();
  });
  el.addEventListener('change', pushHistory);
}
bindText('title', 'title');
bindText('subtitle', 'subtitle');
bindText('badge', 'badge');

document.getElementById('heatDown').addEventListener('click', () => {
  if (state.heat <= 0) return;
  pushHistory();
  state.heat -= 1;
  renderHeatStars();
  redraw();
});
document.getElementById('heatUp').addEventListener('click', () => {
  if (state.heat >= 5) return;
  pushHistory();
  state.heat += 1;
  renderHeatStars();
  redraw();
});

// ---- photo uploads ---------------------------------------------------------

document.getElementById('upload').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const entry = await addPhoto(`upload-${Date.now()}-${file.name}`, file.name, url);
    pushHistory();
    state.panels[activePanel].src = entry.key;
    state.panels[activePanel].scale = 1;
    state.panels[activePanel].dx = 0;
    state.panels[activePanel].dy = 0;
  }
  renderLibrary();
  redraw();
  e.target.value = '';
});

document.getElementById('fillAll').addEventListener('click', () => {
  const src = state.panels[activePanel]?.src;
  if (!src) { statusEl.textContent = 'Pick a photo for the selected panel first.'; return; }
  pushHistory();
  state.panels.forEach((p) => { p.src = src; p.scale = 1; p.dx = 0; p.dy = 0; });
  redraw();
  statusEl.textContent = 'Every panel now uses the same photo.';
});

document.getElementById('resetCrop').addEventListener('click', () => {
  pushHistory();
  const p = state.panels[activePanel];
  p.scale = 1; p.dx = 0; p.dy = 0;
  redraw();
});

// ---- canvas drag / zoom -----------------------------------------------------

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}

function hitPanel(x, y) {
  const geo = layoutGeometry(state.layout, canvas.width, canvas.height);
  for (let i = geo.panels.length - 1; i >= 0; i--) {
    const p = geo.panels[i];
    if (p.titleCell) continue;
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
  }
  return -1;
}

let dragging = null;
canvas.addEventListener('pointerdown', (e) => {
  const pt = canvasPoint(e);
  const hit = hitPanel(pt.x, pt.y);
  if (hit < 0) return;
  activePanel = hit;
  renderPanelButtons();
  renderLibrary();
  dragging = { x: pt.x, y: pt.y, moved: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const pt = canvasPoint(e);
  const geo = layoutGeometry(state.layout, canvas.width, canvas.height);
  const rect = geo.panels[activePanel];
  if (!rect) return;
  const p = state.panels[activePanel];
  p.dx += (pt.x - dragging.x) / rect.w;
  p.dy += (pt.y - dragging.y) / rect.h;
  p.dx = Math.max(-0.6, Math.min(0.6, p.dx));
  p.dy = Math.max(-0.6, Math.min(0.6, p.dy));
  dragging.x = pt.x;
  dragging.y = pt.y;
  dragging.moved = true;
  redraw();
});
canvas.addEventListener('pointerup', () => {
  if (dragging?.moved) pushHistory();
  dragging = null;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const pt = canvasPoint(e);
  const hit = hitPanel(pt.x, pt.y);
  if (hit < 0) return;
  activePanel = hit;
  const p = state.panels[activePanel];
  p.scale = Math.max(1, Math.min(4, p.scale * (e.deltaY < 0 ? 1.08 : 0.93)));
  redraw();
}, { passive: false });

// ---- undo / redo ------------------------------------------------------------

document.getElementById('undo').addEventListener('click', () => {
  if (historyAt <= 0) return;
  historyAt -= 1;
  applySnapshot(history[historyAt]);
  refreshUndoRedo();
});
document.getElementById('redo').addEventListener('click', () => {
  if (historyAt >= history.length - 1) return;
  historyAt += 1;
  applySnapshot(history[historyAt]);
  refreshUndoRedo();
});

// ---- export -----------------------------------------------------------------

function renderAtSize(size) {
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off, state, resolvedImages());
  return off;
}

function downloadCanvas(off, name) {
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve();
    }, 'image/png');
  });
}

document.getElementById('export').addEventListener('click', async () => {
  const size = currentSize();
  await downloadCanvas(renderAtSize(size), `neon-coast-${size.w}x${size.h}.png`);
  statusEl.textContent = `Saved neon-coast-${size.w}x${size.h}.png`;
});

document.getElementById('exportAll').addEventListener('click', async () => {
  statusEl.textContent = 'Exporting all sizes…';
  for (const size of SIZES) {
    await downloadCanvas(renderAtSize(size), `neon-coast-${size.w}x${size.h}.png`);
  }
  statusEl.textContent = 'Saved all 4 sizes.';
});

// ---- boot -------------------------------------------------------------------

async function boot() {
  await addPhoto('pier', 'Pier (sample)', 'samples/pier.jpg');
  await addPhoto('boulevard', 'Boulevard (sample)', 'samples/boulevard.jpg');
  // Default scene: the pier photo in the first panel of the grid.
  state.panels[0].src = 'pier';
  try {
    await document.fonts.load('80px Anton');
    await document.fonts.load('40px Pacifico');
  } catch { /* fonts fall back to system faces */ }

  const query = new URLSearchParams(location.search);
  if (query.get('shot')) {
    await runShot(query, { state, photos, canvas, redraw, syncControls, pushHistory });
  } else {
    syncControls();
    pushHistory();
    redraw();
  }
}

boot();
