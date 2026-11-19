// Neon Coast Cover Studio — editor wiring: state, controls, history,
// pointer crop/zoom, PNG export and the ?shot= query mode for screenshots.
import { LAYOUTS, GRADES, EXPORT_SIZES, panelAt, drawCover, renderCoverCanvas } from './cover.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');

const SAMPLES = [
  { name: 'Pier', src: 'samples/pier.jpg' },
  { name: 'Boulevard', src: 'samples/boulevard.jpg' },
];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + src));
    img.src = src;
  });
}

function panelCount(layoutId) {
  return LAYOUTS[layoutId].panels().length;
}

function defaultSlots(layoutId, photoCount) {
  const n = panelCount(layoutId);
  const slots = [];
  for (let i = 0; i < n; i++) {
    slots.push({ photo: photoCount > 0 ? i % photoCount : 0, zoom: 1, ox: 0, oy: 0 });
  }
  return slots;
}

const state = {
  layout: 'hero',
  grade: 'sunset',
  grain: true,
  vignette: true,
  title: 'Boulevard Queen',
  sub: 'Night Drive',
  badge: 'LAUNCH WEEK',
  heat: 4,
  size: '1080x1080',
  photos: [], // { name, src, img }
  slotsByLayout: {},
  selected: 0,
};

function currentSlots() {
  if (!state.slotsByLayout[state.layout]) {
    state.slotsByLayout[state.layout] = defaultSlots(state.layout, state.photos.length);
  }
  return state.slotsByLayout[state.layout];
}

function currentSize() {
  return EXPORT_SIZES.find((s) => s.id === state.size) || EXPORT_SIZES[0];
}

function renderState() {
  return {
    layout: state.layout,
    grade: state.grade,
    grain: state.grain,
    vignette: state.vignette,
    title: state.title,
    sub: state.sub,
    badge: state.badge,
    heat: state.heat,
    photos: state.photos.map((p) => p.img),
    slots: currentSlots(),
  };
}

// ---- history (undo / redo) ---------------------------------------------
const past = [];
const future = [];

function snapshot() {
  return JSON.stringify({
    layout: state.layout,
    grade: state.grade,
    grain: state.grain,
    vignette: state.vignette,
    title: state.title,
    sub: state.sub,
    badge: state.badge,
    heat: state.heat,
    size: state.size,
    slotsByLayout: state.slotsByLayout,
    selected: state.selected,
    photos: state.photos.map((p) => ({ name: p.name, src: p.src })),
  });
}

async function restore(json) {
  const snap = JSON.parse(json);
  state.layout = snap.layout;
  state.grade = snap.grade;
  state.grain = snap.grain;
  state.vignette = snap.vignette;
  state.title = snap.title;
  state.sub = snap.sub;
  state.badge = snap.badge;
  state.heat = snap.heat;
  state.size = snap.size;
  state.slotsByLayout = snap.slotsByLayout;
  state.selected = snap.selected;
  const loaded = [];
  for (const p of snap.photos) {
    try {
      loaded.push({ name: p.name, src: p.src, img: await loadImage(p.src) });
    } catch {
      // a photo that no longer loads is skipped; its slots fall back below
    }
  }
  if (loaded.length > 0) state.photos = loaded;
  for (const key of Object.keys(state.slotsByLayout)) {
    for (const slot of state.slotsByLayout[key]) {
      slot.photo = Math.max(0, Math.min(state.photos.length - 1, slot.photo || 0));
    }
  }
  state.selected = Math.max(0, Math.min(currentSlots().length - 1, state.selected || 0));
  syncUI();
  render();
}

function commit() {
  past.push(snapshot());
  if (past.length > 60) past.shift();
  future.length = 0;
  syncUndoRedo();
}

function applyChange(fn) {
  commit();
  fn();
  syncUI();
  render();
}

async function undo() {
  if (past.length === 0) return;
  future.push(snapshot());
  await restore(past.pop());
  syncUndoRedo();
}

async function redo() {
  if (future.length === 0) return;
  past.push(snapshot());
  await restore(future.pop());
  syncUndoRedo();
}

function syncUndoRedo() {
  $('undoBtn').disabled = past.length === 0;
  $('redoBtn').disabled = future.length === 0;
}

// ---- rendering -----------------------------------------------------------
const params = new URLSearchParams(location.search);
const coverMode = params.get('shot') === 'cover';

function render() {
  const size = currentSize();
  if (coverMode) {
    stage.width = size.w;
    stage.height = size.h;
  } else {
    const previewW = 880;
    stage.width = previewW;
    stage.height = Math.round((previewW * size.h) / size.w);
  }
  const ctx = stage.getContext('2d');
  drawCover(ctx, stage.width, stage.height, renderState());
  if (!coverMode) drawSelection(ctx);
}

function drawSelection(ctx) {
  const W = stage.width, H = stage.height;
  const panels = LAYOUTS[state.layout].panels();
  const panel = panels[state.selected];
  if (!panel) return;
  ctx.save();
  ctx.strokeStyle = '#ff2d92';
  ctx.lineWidth = Math.max(3, W * 0.004);
  if (panel.clip) {
    ctx.beginPath();
    panel.clip.forEach(([nx, ny], i) => {
      if (i === 0) ctx.moveTo(nx * W, ny * H);
      else ctx.lineTo(nx * W, ny * H);
    });
    ctx.closePath();
    ctx.stroke();
  } else {
    const cx = (panel.x + panel.w / 2) * W;
    const cy = (panel.y + panel.h / 2) * H;
    ctx.translate(cx, cy);
    if (panel.rot) ctx.rotate((panel.rot * Math.PI) / 180);
    ctx.strokeRect((-panel.w * W) / 2, (-panel.h * H) / 2, panel.w * W, panel.h * H);
  }
  ctx.restore();
}

// ---- controls ------------------------------------------------------------
function markActive(container, attr, value) {
  for (const btn of container.querySelectorAll('button')) {
    btn.classList.toggle('active', btn.dataset[attr] === value);
  }
}

function syncUI() {
  markActive($('layoutBtns'), 'layout', state.layout);
  markActive($('gradeBtns'), 'grade', state.grade);
  markActive($('sizeBtns'), 'size', state.size);
  $('grainChk').checked = state.grain;
  $('vignetteChk').checked = state.vignette;
  if ($('titleInput').value !== state.title) $('titleInput').value = state.title;
  if ($('subInput').value !== state.sub) $('subInput').value = state.sub;
  if ($('badgeInput').value !== state.badge) $('badgeInput').value = state.badge;
  for (const btn of $('heatStars').querySelectorAll('button')) {
    btn.classList.toggle('lit', Number(btn.dataset.heat) <= state.heat);
  }
  const tray = $('photoTray');
  tray.querySelectorAll('img').forEach((img, i) => {
    img.classList.toggle('active', currentSlots()[state.selected]?.photo === i);
  });
}

function buildHeatStars() {
  const box = $('heatStars');
  box.innerHTML = '';
  for (let n = 1; n <= 5; n++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.heat = String(n);
    btn.textContent = '★';
    btn.setAttribute('aria-label', n + ' stars');
    btn.addEventListener('click', () => applyChange(() => { state.heat = n; }));
    box.appendChild(btn);
  }
}

function buildTray() {
  const tray = $('photoTray');
  tray.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = photo.name;
    img.title = photo.name;
    img.addEventListener('click', () => {
      applyChange(() => { currentSlots()[state.selected].photo = i; });
    });
    tray.appendChild(img);
  });
  syncUI();
}

async function addPhoto(name, src) {
  const img = await loadImage(src);
  commit();
  state.photos.push({ name, src, img });
  buildTray();
  render();
}

// ---- pointer crop / zoom ---------------------------------------------------
let dragging = false;
let dragCommitted = false;
let lastX = 0, lastY = 0;
let lastWheelCommit = 0;

function coverPoint(event) {
  const rect = stage.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * stage.width,
    y: ((event.clientY - rect.top) / rect.height) * stage.height,
  };
}

stage.addEventListener('pointerdown', (event) => {
  if (coverMode) return;
  const { x, y } = coverPoint(event);
  const hit = panelAt(state.layout, stage.width, stage.height, x, y);
  if (hit < 0) return;
  state.selected = hit;
  dragging = true;
  dragCommitted = false;
  lastX = x;
  lastY = y;
  stage.classList.add('dragging');
  stage.setPointerCapture(event.pointerId);
  syncUI();
  render();
});

stage.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const { x, y } = coverPoint(event);
  const panels = LAYOUTS[state.layout].panels();
  const panel = panels[state.selected];
  const slot = currentSlots()[state.selected];
  if (!panel || !slot) return;
  if (!dragCommitted) {
    commit();
    dragCommitted = true;
  }
  slot.ox = Math.max(-0.6, Math.min(0.6, slot.ox + (x - lastX) / (panel.w * stage.width)));
  slot.oy = Math.max(-0.6, Math.min(0.6, slot.oy + (y - lastY) / (panel.h * stage.height)));
  lastX = x;
  lastY = y;
  render();
});

function endDrag() {
  dragging = false;
  stage.classList.remove('dragging');
}

stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);

stage.addEventListener('wheel', (event) => {
  if (coverMode) return;
  event.preventDefault();
  const slot = currentSlots()[state.selected];
  if (!slot) return;
  const now = Date.now();
  if (now - lastWheelCommit > 500) {
    commit();
    lastWheelCommit = now;
  }
  slot.zoom = Math.max(1, Math.min(4, slot.zoom * Math.exp(-event.deltaY * 0.0012)));
  render();
}, { passive: false });

// ---- export ----------------------------------------------------------------
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function exportSize(size) {
  return new Promise((resolve) => {
    const canvas = renderCoverCanvas(size.w, size.h, renderState());
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `neon-coast-${size.id}.png`);
      resolve(Boolean(blob));
    }, 'image/png');
  });
}

$('exportBtn').addEventListener('click', async () => {
  await exportSize(currentSize());
});

$('exportAllBtn').addEventListener('click', async () => {
  for (const size of EXPORT_SIZES) {
    await exportSize(size);
    await new Promise((r) => setTimeout(r, 300));
  }
});

// ---- wire the control panel --------------------------------------------------
$('layoutBtns').addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-layout]');
  if (!btn) return;
  applyChange(() => {
    state.layout = btn.dataset.layout;
    state.selected = 0;
    currentSlots();
  });
});

$('gradeBtns').addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-grade]');
  if (!btn) return;
  applyChange(() => { state.grade = btn.dataset.grade; });
});

$('grainChk').addEventListener('change', (event) => {
  applyChange(() => { state.grain = event.target.checked; });
});

$('vignetteChk').addEventListener('change', (event) => {
  applyChange(() => { state.vignette = event.target.checked; });
});

$('sizeBtns').addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-size]');
  if (!btn) return;
  state.size = btn.dataset.size;
  syncUI();
  render();
});

let captionSnapshot = null;
for (const [input, key] of [[$('titleInput'), 'title'], [$('subInput'), 'sub'], [$('badgeInput'), 'badge']]) {
  // The pre-edit snapshot is taken on the first keystroke of an editing
  // session, before that keystroke mutates the state, so undo steps back to
  // the caption as it was when the user started typing.
  input.addEventListener('input', () => {
    if (captionSnapshot === null) captionSnapshot = snapshot();
    state[key] = input.value;
    render();
  });
  input.addEventListener('change', () => {
    if (captionSnapshot !== null) {
      past.push(captionSnapshot);
      if (past.length > 60) past.shift();
      future.length = 0;
      captionSnapshot = null;
      syncUndoRedo();
    }
  });
}

$('fileInput').addEventListener('change', async (event) => {
  for (const file of event.target.files) {
    const src = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
    await addPhoto(file.name, src);
  }
  event.target.value = '';
});

$('samplePier').addEventListener('click', async () => {
  if (!state.photos.some((p) => p.name === 'Pier')) await addPhoto('Pier', 'samples/pier.jpg');
});
$('sampleBlvd').addEventListener('click', async () => {
  if (!state.photos.some((p) => p.name === 'Boulevard')) await addPhoto('Boulevard', 'samples/boulevard.jpg');
});

$('undoBtn').addEventListener('click', undo);
$('redoBtn').addEventListener('click', redo);
document.addEventListener('keydown', (event) => {
  const tag = (event.target.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
    event.preventDefault();
    undo();
  } else if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey))) {
    event.preventDefault();
    redo();
  }
});

// ---- start: query params, samples, fonts --------------------------------------
async function start() {
  if (coverMode) document.body.classList.add('cover-shot');

  const wantPhoto = params.get('photo');
  const wantPhoto2 = params.get('photo2');
  const first = wantPhoto
    ? SAMPLES.find((s) => s.name.toLowerCase() === wantPhoto.toLowerCase()) || SAMPLES[1]
    : SAMPLES[1];
  const second = wantPhoto2
    ? SAMPLES.find((s) => s.name.toLowerCase() === wantPhoto2.toLowerCase()) || SAMPLES[0]
    : SAMPLES[0];
  for (const sample of [first, second]) {
    if (state.photos.some((p) => p.name === sample.name)) continue;
    try {
      state.photos.push({ name: sample.name, src: sample.src, img: await loadImage(sample.src) });
    } catch {
      // a missing sample leaves the tray empty for that slot; the app still runs
    }
  }

  if (params.get('layout') && LAYOUTS[params.get('layout')]) state.layout = params.get('layout');
  if (params.get('grade') && GRADES[params.get('grade')]) state.grade = params.get('grade');
  if (params.get('caption')) state.title = params.get('caption');
  if (params.get('sub')) state.sub = params.get('sub');
  if (params.get('badge') !== null) state.badge = params.get('badge') || '';
  if (params.get('heat')) state.heat = Math.max(0, Math.min(5, Number(params.get('heat')) || 0));
  if (params.get('size') && EXPORT_SIZES.some((s) => s.id === params.get('size'))) state.size = params.get('size');
  if (params.get('grain') === '0') state.grain = false;
  if (params.get('vignette') === '0') state.vignette = false;

  buildHeatStars();
  buildTray();
  syncUI();
  syncUndoRedo();

  try {
    await Promise.all([
      document.fonts.load('40px Anton'),
      document.fonts.load('40px Pacifico'),
      document.fonts.ready,
    ]);
  } catch {
    // if a font fails to load, the canvas falls back to sans-serif and still draws
  }
  render();
  window.__ready = true;
}

window.__coverStudio = {
  exportDataURL(w, h) {
    const canvas = renderCoverCanvas(w, h, renderState());
    return canvas.toDataURL('image/png');
  },
  get state() {
    return { layout: state.layout, grade: state.grade, title: state.title, size: state.size };
  },
};

const readyFallback = setTimeout(() => { window.__ready = true; }, 6000);
start().finally(() => clearTimeout(readyFallback));
