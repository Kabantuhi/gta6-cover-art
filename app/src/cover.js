// Neon Coast Cover Studio — canvas cover renderer.
// Everything is drawn locally: photos the user loaded, two bundled fonts,
// colour grades, grain and a vignette. No network request happens here.

const GAP = 0.012;

// Six multi-panel layouts. Every panel is a normalised rectangle
// (fractions of the cover width/height) with an optional rotation in
// degrees, an optional clip polygon, and a frame style.
export const LAYOUTS = {
  grid: {
    label: 'Four-panel grid',
    panels: () => [
      { x: 0, y: 0, w: 0.494, h: 0.494, rot: 0, clip: null, frame: 'dark' },
      { x: 0.506, y: 0, w: 0.494, h: 0.494, rot: 0, clip: null, frame: 'dark' },
      { x: 0, y: 0.506, w: 0.494, h: 0.494, rot: 0, clip: null, frame: 'dark' },
      { x: 0.506, y: 0.506, w: 0.494, h: 0.494, rot: 0, clip: null, frame: 'dark' },
    ],
    caption: { mode: 'band' },
  },
  hero: {
    label: 'Hero + three',
    panels: () => [
      { x: 0, y: 0, w: 0.615, h: 1, rot: 0, clip: null, frame: 'dark' },
      { x: 0.627, y: 0, w: 0.373, h: 0.3253, rot: 0, clip: null, frame: 'dark' },
      { x: 0.627, y: 0.3373, w: 0.373, h: 0.3253, rot: 0, clip: null, frame: 'dark' },
      { x: 0.627, y: 0.6747, w: 0.373, h: 0.3253, rot: 0, clip: null, frame: 'dark' },
    ],
    caption: { mode: 'band' },
  },
  bleed: {
    label: 'Full bleed',
    panels: () => [
      { x: 0, y: 0, w: 1, h: 1, rot: 0, clip: null, frame: 'none' },
    ],
    caption: { mode: 'band' },
  },
  nine: {
    label: 'Nine-panel grid',
    panels: () => {
      const cell = 0.3253;
      const at = [0, 0.3373, 0.6747];
      const panels = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          if (row === 1 && col === 1) continue; // the centre cell is the title block
          panels.push({ x: at[col], y: at[row], w: cell, h: cell, rot: 0, clip: null, frame: 'dark' });
        }
      }
      return panels;
    },
    caption: { mode: 'cell', x: 0.3373, y: 0.3373, w: 0.3253, h: 0.3253 },
  },
  tilt: {
    label: 'Tilted snapshot',
    panels: () => [
      { x: 0.03, y: 0.05, w: 0.54, h: 0.62, rot: -6, clip: null, frame: 'polaroid' },
      { x: 0.25, y: 0.1, w: 0.54, h: 0.62, rot: 2, clip: null, frame: 'polaroid' },
      { x: 0.45, y: 0.05, w: 0.54, h: 0.62, rot: 7, clip: null, frame: 'polaroid' },
    ],
    caption: { mode: 'band' },
  },
  duo: {
    label: 'Diagonal duo',
    panels: () => [
      { x: 0, y: 0, w: 1, h: 1, rot: 0, clip: [[0, 0], [1, 0], [0, 1]], frame: 'diagonal' },
      { x: 0, y: 0, w: 1, h: 1, rot: 0, clip: [[1, 0], [1, 1], [0, 1]], frame: 'diagonal' },
    ],
    caption: { mode: 'band' },
  },
};

// Five colour grades. Each layer is a wash drawn over the whole cover
// with a blend mode: a gradient, a radial glow or a flat tint.
export const GRADES = {
  sunset: {
    label: 'Sunset',
    layers: [
      { kind: 'linear', x0: 0, y0: 0, x1: 0, y1: 1, stops: [[0, 'rgba(255,150,60,0.55)'], [0.55, 'rgba(255,80,90,0.12)'], [1, 'rgba(255,45,120,0.30)']], composite: 'screen' },
      { kind: 'solid', color: 'rgba(255,140,40,0.20)', composite: 'soft-light' },
      { kind: 'solid', color: 'rgba(120,20,80,0.14)', composite: 'multiply' },
    ],
  },
  neon: {
    label: 'Neon Nights',
    layers: [
      { kind: 'radial', cx: 0.12, cy: 0.08, r: 0.75, stops: [[0, 'rgba(255,45,150,0.34)'], [1, 'rgba(255,45,150,0)']], composite: 'screen' },
      { kind: 'radial', cx: 0.9, cy: 0.95, r: 0.8, stops: [[0, 'rgba(60,220,255,0.30)'], [1, 'rgba(60,220,255,0)']], composite: 'screen' },
      { kind: 'solid', color: 'rgba(150,60,255,0.18)', composite: 'overlay' },
    ],
  },
  vice: {
    label: 'Vice Pink',
    layers: [
      { kind: 'solid', color: 'rgba(255,80,180,0.36)', composite: 'soft-light' },
      { kind: 'linear', x0: 0, y0: 0, x1: 0, y1: 1, stops: [[0, 'rgba(255,120,200,0.22)'], [1, 'rgba(255,120,200,0)']], composite: 'screen' },
      { kind: 'solid', color: 'rgba(120,40,160,0.14)', composite: 'multiply' },
    ],
  },
  teal: {
    label: 'Teal Dusk',
    layers: [
      { kind: 'solid', color: 'rgba(20,160,180,0.26)', composite: 'overlay' },
      { kind: 'linear', x0: 0, y0: 0, x1: 0, y1: 1, stops: [[0, 'rgba(120,220,255,0.20)'], [1, 'rgba(120,220,255,0)']], composite: 'screen' },
      { kind: 'solid', color: 'rgba(10,60,90,0.16)', composite: 'multiply' },
    ],
  },
  golden: {
    label: 'Golden Hour',
    layers: [
      { kind: 'solid', color: 'rgba(255,180,60,0.32)', composite: 'soft-light' },
      { kind: 'radial', cx: 0.5, cy: 0.05, r: 0.9, stops: [[0, 'rgba(255,210,110,0.30)'], [1, 'rgba(255,210,110,0)']], composite: 'screen' },
      { kind: 'solid', color: 'rgba(120,70,10,0.10)', composite: 'multiply' },
    ],
  },
};

export const EXPORT_SIZES = [
  { id: '1080x1080', w: 1080, h: 1080 },
  { id: '1080x1350', w: 1080, h: 1350 },
  { id: '1920x1080', w: 1920, h: 1080 },
  { id: '1080x1920', w: 1080, h: 1920 },
];

function pointInPoly(nx, ny, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (yi > ny !== yj > ny && nx < ((xj - xi) * (ny - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Which photo panel, if any, sits under a point given in cover pixels.
export function panelAt(layoutId, W, H, x, y) {
  const panels = LAYOUTS[layoutId].panels();
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (p.clip) {
      if (pointInPoly(x / W, y / H, p.clip)) return i;
      continue;
    }
    const cx = (p.x + p.w / 2) * W;
    const cy = (p.y + p.h / 2) * H;
    const rad = (-(p.rot || 0) * Math.PI) / 180;
    const dx = x - cx, dy = y - cy;
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
    if (Math.abs(lx) <= (p.w * W) / 2 && Math.abs(ly) <= (p.h * H) / 2) return i;
  }
  return -1;
}

function drawPhoto(ctx, panel, img, slot, W, H) {
  const px = panel.x * W, py = panel.y * H;
  const pw = panel.w * W, ph = panel.h * H;
  ctx.save();
  if (panel.clip) {
    ctx.beginPath();
    panel.clip.forEach(([nx, ny], i) => {
      if (i === 0) ctx.moveTo(nx * W, ny * H);
      else ctx.lineTo(nx * W, ny * H);
    });
    ctx.closePath();
    ctx.clip();
  } else {
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();
  }
  const cx = px + pw / 2, cy = py + ph / 2;
  ctx.translate(cx, cy);
  if (panel.rot) ctx.rotate((panel.rot * Math.PI) / 180);
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const base = Math.max(pw / iw, ph / ih);
  const pad = panel.rot ? 1.15 : 1; // a tilted photo needs a little extra to cover its corners
  const s = base * slot.zoom * pad;
  ctx.drawImage(img, slot.ox * pw - (iw * s) / 2, slot.oy * ph - (ih * s) / 2, iw * s, ih * s);
  ctx.restore();

  if (panel.frame === 'dark') {
    ctx.save();
    ctx.strokeStyle = 'rgba(16,6,32,0.9)';
    ctx.lineWidth = Math.max(2, W * 0.002);
    ctx.strokeRect(px, py, pw, ph);
    ctx.restore();
  } else if (panel.frame === 'polaroid') {
    ctx.save();
    ctx.translate(cx, cy);
    if (panel.rot) ctx.rotate((panel.rot * Math.PI) / 180);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = W * 0.02;
    ctx.shadowOffsetY = W * 0.008;
    ctx.strokeStyle = '#f8f4ee';
    ctx.lineWidth = Math.max(6, W * 0.008);
    ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);
    ctx.restore();
  } else if (panel.frame === 'diagonal') {
    ctx.save();
    ctx.strokeStyle = 'rgba(16,6,32,0.95)';
    ctx.lineWidth = Math.max(3, W * 0.004);
    ctx.beginPath();
    ctx.moveTo(W, 0);
    ctx.lineTo(0, H);
    ctx.stroke();
    ctx.restore();
  }
}

function applyGrade(ctx, gradeId, W, H) {
  const grade = GRADES[gradeId] || GRADES.sunset;
  for (const layer of grade.layers) {
    ctx.save();
    ctx.globalCompositeOperation = layer.composite;
    if (layer.kind === 'solid') {
      ctx.fillStyle = layer.color;
      ctx.fillRect(0, 0, W, H);
    } else if (layer.kind === 'linear') {
      const g = ctx.createLinearGradient(layer.x0 * W, layer.y0 * H, layer.x1 * W, layer.y1 * H);
      for (const [at, color] of layer.stops) g.addColorStop(at, color);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    } else if (layer.kind === 'radial') {
      const r = layer.r * Math.max(W, H);
      const g = ctx.createRadialGradient(layer.cx * W, layer.cy * H, 0, layer.cx * W, layer.cy * H, r);
      for (const [at, color] of layer.stops) g.addColorStop(at, color);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }
}

function fitFont(ctx, text, family, startSize, maxWidth) {
  let size = startSize;
  while (size > 12) {
    ctx.font = `${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size *= 0.92;
  }
  ctx.font = `${size}px ${family}`;
  return size;
}

function drawTitle(ctx, text, cx, baselineY, size, maxWidth) {
  if (!text) return;
  const fitted = fitFont(ctx, text.toUpperCase(), 'Anton, sans-serif', size, maxWidth);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, fitted * 0.09);
  ctx.strokeStyle = '#0d0518';
  ctx.strokeText(text.toUpperCase(), cx, baselineY);
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = fitted * 0.12;
  ctx.shadowOffsetY = fitted * 0.05;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text.toUpperCase(), cx, baselineY);
  ctx.restore();
}

function drawSubtitle(ctx, text, cx, baselineY, size) {
  if (!text) return;
  ctx.save();
  ctx.font = `${size}px Pacifico, cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = '#ff2d92';
  ctx.shadowBlur = size * 0.45;
  ctx.fillStyle = '#ff5db1';
  ctx.fillText(text, cx, baselineY);
  ctx.restore();
}

function drawStars(ctx, heat, cx, baselineY, size) {
  const filled = '★'.repeat(Math.max(0, Math.min(5, heat)));
  const empty = '☆'.repeat(5 - Math.max(0, Math.min(5, heat)));
  ctx.save();
  ctx.font = `${size}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const gap = size * 0.18;
  const total = ctx.measureText(filled + empty).width + gap * 4;
  let x = cx - total / 2;
  ctx.fillStyle = '#ffc93d';
  for (const ch of filled) {
    ctx.fillText(ch, x, baselineY);
    x += ctx.measureText(ch).width + gap;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const ch of empty) {
    ctx.fillText(ch, x, baselineY);
    x += ctx.measureText(ch).width + gap;
  }
  ctx.restore();
}

function drawRibbon(ctx, badge, W, H) {
  if (!badge) return;
  // A diagonal ribbon across the top-right corner: after rotating 45° about
  // the corner, the band's centre line sits d away from the corner, so the
  // band enters through the top edge and leaves through the right edge with
  // the whole badge text visible on the stretch between the two crossings.
  const d = 0.21 * Math.min(W, H);
  const bandH = 0.076 * W;
  ctx.save();
  ctx.translate(W, 0);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#ff2d92';
  ctx.fillRect(-0.35 * W, d - bandH / 2, 0.7 * W, bandH);
  ctx.font = `${Math.round(W * 0.036)}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(badge.toUpperCase(), 0, d);
  ctx.restore();
}

let noiseTile = null;
function grainTile() {
  if (noiseTile) return noiseTile;
  const c = document.createElement('canvas');
  c.width = 180;
  c.height = 180;
  const g = c.getContext('2d');
  const data = g.createImageData(180, 180);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 110 + Math.floor(Math.random() * 90);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  noiseTile = c;
  return noiseTile;
}

// Draw the whole cover for the given state onto ctx at W x H pixels.
// state: { layout, grade, grain, vignette, title, sub, badge, heat,
//          photos: HTMLImageElement[], slots: [{photo, zoom, ox, oy}] }
export function drawCover(ctx, W, H, state) {
  const def = LAYOUTS[state.layout] || LAYOUTS.grid;
  const panels = def.panels();

  ctx.save();
  ctx.fillStyle = '#14082b';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  panels.forEach((panel, i) => {
    const slot = state.slots[i] || { photo: 0, zoom: 1, ox: 0, oy: 0 };
    const img = state.photos[slot.photo] || state.photos[0];
    if (img) drawPhoto(ctx, panel, img, slot, W, H);
  });

  applyGrade(ctx, state.grade, W, H);

  if (def.caption.mode === 'cell') {
    const c = def.caption;
    const cx = c.x * W, cy = c.y * H, cw = c.w * W, ch = c.h * H;
    ctx.save();
    ctx.fillStyle = '#1d0b36';
    ctx.fillRect(cx, cy, cw, ch);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx, cy, cw, ch);
    ctx.restore();
    drawTitle(ctx, state.title, cx + cw / 2, cy + ch * 0.44, ch * 0.32, cw * 0.9);
    drawSubtitle(ctx, state.sub, cx + cw / 2, cy + ch * 0.68, ch * 0.16);
    drawStars(ctx, state.heat, cx + cw / 2, cy + ch * 0.88, ch * 0.11);
  } else {
    const band = ctx.createLinearGradient(0, H * 0.62, 0, H);
    band.addColorStop(0, 'rgba(10,4,24,0)');
    band.addColorStop(1, 'rgba(10,4,24,0.88)');
    ctx.save();
    ctx.fillStyle = band;
    ctx.fillRect(0, H * 0.62, W, H * 0.38);
    ctx.restore();
    drawTitle(ctx, state.title, W / 2, H * 0.855, W * 0.115, W * 0.94);
    drawSubtitle(ctx, state.sub, W / 2, H * 0.925, W * 0.05);
    drawStars(ctx, state.heat, W / 2, H * 0.972, W * 0.03);
  }

  drawRibbon(ctx, state.badge, W, H);

  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (state.vignette) {
    ctx.save();
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(4,2,10,0)');
    g.addColorStop(1, 'rgba(4,2,10,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// Render the cover to a fresh canvas at exactly W x H pixels.
export function renderCoverCanvas(W, H, state) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  drawCover(canvas.getContext('2d'), W, H, state);
  return canvas;
}
