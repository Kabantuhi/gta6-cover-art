// Neon Coast Cover Studio — the cover renderer.
// Draws the multi-panel GTA-style poster onto a canvas at any export size.
// Every layout is described in normalised coordinates (0..1 of the canvas) so the
// same state renders identically at 1080x1080, 1080x1350, 1920x1080 and 1080x1920.

export const SIZES = [
  { id: 'square', label: '1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: '1080 × 1350', w: 1080, h: 1350 },
  { id: 'wide', label: '1920 × 1080', w: 1920, h: 1080 },
  { id: 'story', label: '1080 × 1920', w: 1080, h: 1920 },
];

export const LAYOUTS = {
  grid: { name: 'Four-panel grid', panels: 4 },
  hero: { name: 'Hero + three', panels: 4 },
  fullbleed: { name: 'Full bleed', panels: 1 },
  nine: { name: 'Nine-panel grid', panels: 9 },
  tilt: { name: 'Tilted snapshot', panels: 3 },
  duo: { name: 'Diagonal duo', panels: 2 },
};

export const GRADES = {
  sunset: { name: 'Sunset', blend: 'overlay', alpha: 0.55, stops: ['#ff9a3d', '#ff5e7a', '#7b2fbe'] },
  neon: { name: 'Neon Nights', blend: 'overlay', alpha: 0.5, stops: ['#00f0ff', '#ff2fb3', '#7a00ff'] },
  vice: { name: 'Vice Pink', blend: 'soft-light', alpha: 0.62, stops: ['#ff7ad9', '#ff9de2', '#2de2ff'] },
  teal: { name: 'Teal Dusk', blend: 'overlay', alpha: 0.5, stops: ['#0affef', '#0077ff', '#001233'] },
  golden: { name: 'Golden Hour', blend: 'soft-light', alpha: 0.58, stops: ['#ffd76a', '#ff9d00', '#7a2d00'] },
};

export function panelCount(layout) {
  return LAYOUTS[layout]?.panels ?? 4;
}

// Panel geometry for a layout, in canvas pixels. Each panel: { x, y, w, h, rotate, poly }.
// `title` says where the caption goes: a bottom band, a scrim over the photo, or the
// centre cell of the nine-panel grid.
export function layoutGeometry(layout, W, H) {
  const g = 0.012; // gutter, normalised
  const gx = g * W;
  const gy = g * H;
  switch (layout) {
    case 'grid': {
      const bandY = 0.8 * H;
      const pw = (W - 3 * gx) / 2;
      const ph = (bandY - 3 * gy) / 2;
      return {
        title: { kind: 'band', x: 0, y: bandY, w: W, h: H - bandY },
        panels: [
          { x: gx, y: gy, w: pw, h: ph },
          { x: 2 * gx + pw, y: gy, w: pw, h: ph },
          { x: gx, y: 2 * gy + ph, w: pw, h: ph },
          { x: 2 * gx + pw, y: 2 * gy + ph, w: pw, h: ph },
        ],
      };
    }
    case 'hero': {
      const bandY = 0.82 * H;
      const pw = (W - 4 * gx) / 3;
      const ph = bandY - 0.56 * H - gy;
      return {
        title: { kind: 'band', x: 0, y: bandY, w: W, h: H - bandY },
        panels: [
          { x: gx, y: gy, w: W - 2 * gx, h: 0.55 * H - gy },
          { x: gx, y: 0.56 * H, w: pw, h: ph },
          { x: 2 * gx + pw, y: 0.56 * H, w: pw, h: ph },
          { x: 3 * gx + 2 * pw, y: 0.56 * H, w: pw, h: ph },
        ],
      };
    }
    case 'fullbleed':
      return {
        title: { kind: 'scrim', x: 0, y: 0.58 * H, w: W, h: 0.42 * H },
        panels: [{ x: 0, y: 0, w: W, h: H }],
      };
    case 'nine': {
      const cw = (W - 4 * gx) / 3;
      const ch = (H - 4 * gy) / 3;
      const panels = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          panels.push({ x: gx + c * (cw + gx), y: gy + r * (ch + gy), w: cw, h: ch, titleCell: r === 1 && c === 1 });
        }
      }
      return { title: { kind: 'cell' }, panels };
    }
    case 'tilt': {
      const bandY = 0.82 * H;
      return {
        title: { kind: 'band', x: 0, y: bandY, w: W, h: H - bandY },
        panels: [
          { x: 0.03 * W, y: 0.08 * H, w: 0.3 * W, h: 0.32 * H, rotate: -8 },
          { x: 0.68 * W, y: 0.05 * H, w: 0.29 * W, h: 0.3 * H, rotate: 6 },
          { x: 0.17 * W, y: 0.05 * H, w: 0.66 * W, h: 0.68 * H, rotate: -3, border: true },
        ],
      };
    }
    case 'duo': {
      const bandY = 0.8 * H;
      return {
        title: { kind: 'band', x: 0, y: bandY, w: W, h: H - bandY },
        panels: [
          { x: 0, y: 0, w: W, h: bandY, poly: [[0, 0], [0.58, 0], [0.46, 0.8], [0, 0.8]] },
          { x: 0, y: 0, w: W, h: bandY, poly: [[0.58, 0], [1, 0], [1, 0.8], [0.46, 0.8]] },
        ],
      };
    }
    default:
      return layoutGeometry('grid', W, H);
  }
}

// A small seeded generator so the grain is identical on every export.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let grainPattern = null;
function getGrainPattern(ctx) {
  if (grainPattern) return grainPattern;
  const tile = document.createElement('canvas');
  tile.width = 128; tile.height = 128;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(128, 128);
  const rnd = mulberry32(1337);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 28;
  }
  tctx.putImageData(img, 0, 0);
  grainPattern = ctx.createPattern(tile, 'repeat');
  return grainPattern;
}

// Draws one photo into a panel rect, cover-fit, with the panel's crop (scale/offset).
function drawPhotoInto(ctx, img, rect, panel) {
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  // Default crop anchor: when the photo is much taller than the panel, anchor
  // near the top so a person's face stays in frame instead of being cropped out.
  const cropRatio = (img.naturalHeight * base) / rect.h;
  const anchor = Math.min(0.92, 0.5 + (cropRatio - 1) * 0.5);
  const s = base * (panel.scale || 1);
  const pw = img.naturalWidth * s;
  const ph = img.naturalHeight * s;
  const cx = rect.x + rect.w / 2 + (panel.dx || 0) * rect.w;
  const cy = rect.y + rect.h * anchor + (panel.dy || 0) * rect.h;
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
}

function clipPanel(ctx, rect) {
  ctx.beginPath();
  if (rect.poly) {
    rect.poly.forEach(([px, py], i) => {
      const x = px * rect.w + rect.x;
      const y = py * rect.h + rect.y;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
  } else {
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.clip();
}

function strokePanelBorder(ctx, rect, W) {
  ctx.save();
  ctx.beginPath();
  if (rect.poly) {
    rect.poly.forEach(([px, py], i) => {
      const x = px * rect.w + rect.x;
      const y = py * rect.h + rect.y;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
  } else {
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.lineWidth = Math.max(2, W * 0.004);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.stroke();
  ctx.restore();
}

function drawStar(ctx, cx, cy, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = '#ffd23d';
    ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    ctx.stroke();
  }
}

function drawHeatMeter(ctx, x, y, size, heat) {
  const r = size / 2;
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, x + i * size * 1.25, y, r, i < heat);
  }
}

// Fits the title on one line inside maxWidth, shrinking the font until it fits.
function fitFont(ctx, text, family, weight, startSize, maxWidth) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

function drawTitleBlock(ctx, area, state, W) {
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim();
  const cx = area.x + area.w / 2;
  if (title) {
    const size = fitFont(ctx, title, 'Anton, sans-serif', 400, area.h * 0.52, area.w * 0.92);
    ctx.save();
    try { ctx.letterSpacing = `${Math.max(1, size * 0.04)}px`; } catch { /* older canvas */ }
    ctx.font = `400 ${size}px Anton, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = size * 0.18;
    ctx.shadowOffsetY = size * 0.04;
    const ty = area.y + area.h * (subtitle ? 0.36 : 0.5);
    ctx.strokeText(title, cx, ty);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, cx, ty);
    ctx.restore();
  }
  if (subtitle) {
    const size = fitFont(ctx, subtitle, 'Pacifico, cursive', 400, area.h * 0.3, area.w * 0.9);
    ctx.save();
    ctx.font = `400 ${size}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff5ec4';
    ctx.shadowColor = '#ff2fb3';
    ctx.shadowBlur = size * 0.55;
    ctx.fillText(subtitle, cx, area.y + area.h * 0.78);
    ctx.restore();
  }
}

function drawBadgeRibbon(ctx, W, H, badge) {
  if (!badge) return;
  const text = badge.trim().toUpperCase();
  if (!text) return;
  // A diagonal band across the top-right corner: it runs from a point on the
  // top edge to a point on the right edge, so its centre sits inside the cover.
  const run = Math.max(150, W * 0.22); // run along each edge
  const len = run * Math.SQRT2; // length of the band between the two edges
  const h = Math.max(26, H * 0.042);
  ctx.save();
  ctx.translate(W - run / 2, run / 2);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#ff2fb3';
  ctx.fillRect(-len / 2, -h / 2, len, h);
  ctx.fillStyle = '#ffffff';
  ctx.font = `400 ${Math.round(h * 0.52)}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 1);
  ctx.restore();
}

// The main entry: draws the whole cover onto `canvas` at its own size.
export function drawCover(canvas, state, images) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const grade = GRADES[state.grade] || GRADES.sunset;
  const geo = layoutGeometry(state.layout, W, H);

  ctx.save();
  ctx.fillStyle = '#14082a';
  ctx.fillRect(0, 0, W, H);

  // Caption band background (for band layouts) sits under the grade.
  if (geo.title.kind === 'band') {
    ctx.fillStyle = '#1a0b30';
    ctx.fillRect(geo.title.x, geo.title.y, geo.title.w, geo.title.h);
  }

  // Panels: photo, clipped, with a thin dark border. Rotated panels pivot on centre.
  geo.panels.forEach((rect, i) => {
    if (rect.titleCell) return; // the centre cell of the nine grid holds the title
    const panel = state.panels[i] || {};
    const img = images[i];
    ctx.save();
    if (rect.rotate) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate((rect.rotate * Math.PI) / 180);
      ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));
    }
    if (rect.border) {
      ctx.fillStyle = '#ffffff';
      const b = Math.max(6, W * 0.012);
      ctx.fillRect(rect.x - b, rect.y - b, rect.w + 2 * b, rect.h + 2 * b + b * 1.6);
    }
    clipPanel(ctx, rect);
    if (img) drawPhotoInto(ctx, img, rect, panel);
    else {
      ctx.fillStyle = '#2b1745';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
    strokePanelBorder(ctx, rect, W);
  });

  // Colour grade: a sunset/neon gradient washed over the whole cover.
  const grad = ctx.createLinearGradient(0, 0, W * 0.25, H);
  grade.stops.forEach((c, i) => grad.addColorStop(i / (grade.stops.length - 1), c));
  ctx.save();
  ctx.globalCompositeOperation = grade.blend;
  ctx.globalAlpha = grade.alpha;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Bottom scrim for the full-bleed layout so the caption stays legible.
  if (geo.title.kind === 'scrim') {
    const scrim = ctx.createLinearGradient(0, H * 0.5, 0, H);
    scrim.addColorStop(0, 'rgba(10,0,20,0)');
    scrim.addColorStop(1, 'rgba(10,0,20,0.78)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, H * 0.5, W, H * 0.5);
  }

  // Grain + vignette, the same on every export (seeded noise).
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = getGrainPattern(ctx);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.36)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // Badge ribbon across the top-right corner.
  drawBadgeRibbon(ctx, W, H, state.badge);

  // Caption + heat meter.
  if (geo.title.kind === 'band') {
    drawTitleBlock(ctx, geo.title, state, W);
    const starSize = Math.min(geo.title.h * 0.3, 30);
    ctx.save();
    drawHeatMeter(ctx, geo.title.x + geo.title.w - starSize * 6.6, geo.title.y + geo.title.h * 0.82, starSize, state.heat || 0);
    ctx.restore();
  } else if (geo.title.kind === 'scrim') {
    const area = { x: W * 0.05, y: H * 0.78, w: W * 0.9, h: H * 0.2 };
    drawTitleBlock(ctx, area, state, W);
    const starSize = Math.min(H * 0.024, 30);
    drawHeatMeter(ctx, W * 0.05, H * 0.72, starSize, state.heat || 0);
  } else if (geo.title.kind === 'cell') {
    const cell = geo.panels.find((p) => p.titleCell);
    if (cell) {
      ctx.save();
      ctx.fillStyle = '#1a0b30';
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
      ctx.restore();
      const area = { x: cell.x + cell.w * 0.06, y: cell.y + cell.h * 0.08, w: cell.w * 0.88, h: cell.h * 0.84 };
      drawTitleBlock(ctx, area, state, W);
      const starSize = Math.min(cell.h * 0.14, 22);
      drawHeatMeter(ctx, cell.x + cell.w / 2 - starSize * 3.1, cell.y + cell.h * 0.94, starSize, state.heat || 0);
    }
  }
  ctx.restore();
}
