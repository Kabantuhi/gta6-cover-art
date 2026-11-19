// Fixed scenes for screenshots: ?shot=cover shows the cover alone, full frame;
// ?shot=editor shows the editor with a sample photo loaded. The query picks the
// layout, grade, photos and caption. window.__shotReady is set once painted.
import { panelCount } from './cover.js';

function paintReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

export async function runShot(query, api) {
  const { state, photos, canvas, redraw, syncControls, pushHistory } = api;
  const shot = query.get('shot');

  // State from the query, with the defaults as fallback.
  if (query.get('layout')) state.layout = query.get('layout');
  if (query.get('grade')) state.grade = query.get('grade');
  if (query.get('caption')) state.title = query.get('caption');
  if (query.get('sub')) state.subtitle = query.get('sub');
  if (query.get('badge')) state.badge = query.get('badge');
  if (query.get('heat') !== null) state.heat = Math.max(0, Math.min(5, Number(query.get('heat')) || 0));

  // Panels: spread the named photos across them (photo2 alternates with photo).
  const n = panelCount(state.layout);
  state.panels = Array.from({ length: n }, (_, i) => ({ src: null, scale: 1, dx: 0, dy: 0 }));
  const first = query.get('photo') ?? 'pier';
  const second = query.get('photo2');
  for (let i = 0; i < n; i++) {
    const key = second && i % 2 === 1 ? second : first;
    if (photos.some((p) => p.key === key)) state.panels[i].src = key;
  }

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const size = query.get('size');
    if (size) {
      const [w, h] = size.split('x').map(Number);
      if (w > 0 && h > 0) { canvas.width = w; canvas.height = h; }
    }
    syncControls();
    redraw();
    paintReady();
    return;
  }

  // Editor scene: the normal UI, a photo loaded, ready to edit.
  syncControls();
  pushHistory();
  redraw();
  paintReady();
}
