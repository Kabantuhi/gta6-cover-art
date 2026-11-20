// Neon Coast Cover Studio — cover renderer.
// Draws a GTA 6-style cover onto a canvas: sunset/neon grade, a sun,
// a second inset panel, a diagonal slash, a bold title and a script accent.
// Everything here is deterministic: the same inputs always paint the same
// pixels, so screenshots taken from this renderer are stable.

/** A tiny seeded generator, so the film grain never changes between runs. */
function seededRandom(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Draw `img` to fill `w` x `h` (center-crop "cover" fit). */
function drawCoverFit(ctx, img, x, y, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih || w <= 0 || h <= 0) return;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** Wrap `text` into at most `maxLines` lines at the given font. */
function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth || !current) {
      current = trial;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current) lines.push(current);
  // If words remain after the last allowed line, fold them in with an ellipsis.
  if (lines.length === maxLines) {
    const used = lines.join(' ').split(/\s+/).length;
    if (used < words.length) {
      let last = lines[lines.length - 1];
      while (last.length > 3 && ctx.measureText(`${last}…`).width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[lines.length - 1] = `${last}…`;
    }
  }
  return lines;
}

/**
 * Paint a GTA 6-style cover.
 * @param {HTMLCanvasElement} canvas
 * @param {{image: HTMLImageElement|null, title: string, accent: string, width: number, height: number}} opts
 */
export function drawCover(canvas, opts) {
  const { image, title, accent, width, height } = opts;
  const w = Math.max(1, Math.round(width) || 1080);
  const h = Math.max(1, Math.round(height) || 1080);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const hasImage = image && (image.naturalWidth || image.width) > 0 && (image.naturalHeight || image.height) > 0;

  // 1. Base.
  ctx.fillStyle = '#0b0b1a';
  ctx.fillRect(0, 0, w, h);

  // 2. Photo, cover fit.
  if (hasImage) drawCoverFit(ctx, image, 0, 0, w, h);

  // 3. Sunset / neon grade: vertical wash from clear sky to hot magenta-purple floor.
  const grade = ctx.createLinearGradient(0, 0, 0, h);
  grade.addColorStop(0.0, 'rgba(255, 122, 24, 0)');
  grade.addColorStop(0.35, 'rgba(255, 122, 24, 0.12)');
  grade.addColorStop(0.62, 'rgba(255, 122, 24, 0.35)');
  grade.addColorStop(0.82, 'rgba(255, 45, 120, 0.45)');
  grade.addColorStop(1.0, 'rgba(123, 47, 255, 0.50)');
  ctx.fillStyle = grade;
  ctx.fillRect(0, 0, w, h);

  // Warm radial glow, top-right, like late sun on glass.
  const glow = ctx.createRadialGradient(w * 0.82, h * 0.14, 0, w * 0.82, h * 0.14, w * 0.55);
  glow.addColorStop(0, 'rgba(255, 190, 80, 0.38)');
  glow.addColorStop(0.55, 'rgba(255, 122, 24, 0.14)');
  glow.addColorStop(1, 'rgba(255, 122, 24, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // 5. The sun: a big disc, top-right, yellow core melting into orange and pink.
  const sunR = Math.min(w, h) * 0.13;
  const sunX = w * 0.80;
  const sunY = h * 0.20;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.4);
  sunGlow.addColorStop(0, 'rgba(255, 214, 90, 0.55)');
  sunGlow.addColorStop(0.5, 'rgba(255, 122, 24, 0.18)');
  sunGlow.addColorStop(1, 'rgba(255, 122, 24, 0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * 2.4, 0, Math.PI * 2);
  ctx.fill();
  const sun = ctx.createLinearGradient(sunX, sunY - sunR, sunX, sunY + sunR);
  sun.addColorStop(0, '#ffe14d');
  sun.addColorStop(0.55, '#ff7a18');
  sun.addColorStop(1, '#ff2d78');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // 4. Second inset panel, bottom-right: the same photo with a different crop,
  // a thick white frame and a drop shadow — the multi-panel GTA feel.
  if (hasImage) {
    const pw = w * 0.38;
    const ph = h * 0.45;
    const px = w - pw - w * 0.045;
    const py = h - ph - h * 0.06;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = w * 0.02;
    ctx.shadowOffsetX = -w * 0.008;
    ctx.shadowOffsetY = h * 0.012;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px - 4, py - 4, pw + 8, ph + 8);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();
    // A different crop: zoom in and shift the focus up-left.
    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    const zoom = Math.max(pw / iw, ph / ih) * 1.35;
    const dw = iw * zoom;
    const dh = ih * zoom;
    ctx.drawImage(image, px + (pw - dw) / 2 - pw * 0.08, py + (ph - dh) / 2 - ph * 0.06, dw, dh);
    const panelGrade = ctx.createLinearGradient(px, py, px, py + ph);
    panelGrade.addColorStop(0, 'rgba(255, 122, 24, 0.05)');
    panelGrade.addColorStop(1, 'rgba(123, 47, 255, 0.35)');
    ctx.fillStyle = panelGrade;
    ctx.fillRect(px, py, pw, ph);
    ctx.restore();
  }

  // One thin diagonal slash bar across the canvas, neon cyan, for style.
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-0.32);
  ctx.fillStyle = 'rgba(0, 229, 255, 0.9)';
  ctx.fillRect(-w * 0.62, -h * 0.012, w * 1.24, h * 0.008);
  ctx.fillStyle = 'rgba(255, 45, 120, 0.85)';
  ctx.fillRect(-w * 0.62, h * 0.004, w * 1.24, h * 0.004);
  ctx.restore();

  // Vignette: dark edges pull the eye to the middle.
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(5, 5, 20, 0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // 8. "NEON COAST" tag, top-left, letter-spaced, white with a black outline.
  const tagSize = Math.max(14, w * 0.028);
  ctx.save();
  ctx.font = `${tagSize}px Anton, 'Arial Black', sans-serif`;
  ctx.textBaseline = 'alphabetic';
  const tag = 'N E O N   C O A S T';
  ctx.lineWidth = Math.max(2, tagSize * 0.18);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.lineJoin = 'round';
  ctx.strokeText(tag, w * 0.04, h * 0.065);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(tag, w * 0.04, h * 0.065);
  ctx.restore();

  // 6. Title: big Anton caps, white fill, black outline, pink drop shadow.
  // The accent sits above the TOP line of the title (not the bottom one),
  // so a two-line title never paints over it.
  const accentText = (accent || '').trim();
  const titleText = (title || 'SUNSET HEIST').trim().toUpperCase() || 'SUNSET HEIST';
  const titleSize = w * 0.11;
  const accentSize = w * 0.05;
  const margin = w * 0.05;
  const titleBottom = h * 0.94;
  const lineHeight = titleSize * 1.02;

  ctx.save();
  ctx.translate(margin, titleBottom);
  ctx.rotate(-0.035); // about -2 degrees
  ctx.textBaseline = 'alphabetic';

  ctx.font = `${titleSize}px Anton, 'Arial Black', sans-serif`;
  const maxTitleWidth = w - margin * 2 - w * 0.42; // keep clear of the inset panel
  const lines = wrapLines(ctx, titleText, maxTitleWidth, 2);

  if (accentText) {
    ctx.font = `${accentSize}px Pacifico, cursive`;
    ctx.shadowColor = 'rgba(0, 229, 255, 0.9)';
    ctx.shadowBlur = accentSize * 0.35;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = Math.max(2, accentSize * 0.12);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineJoin = 'round';
    // Clear the title's top line entirely: the accent baseline must sit
    // above the top line's cap height plus the accent's own descenders.
    const accentY = -((lines.length - 1) * lineHeight) - lineHeight * 0.85 - accentSize * 0.3;
    ctx.strokeText(accentText, 0, accentY);
    ctx.fillStyle = '#ffe14d';
    ctx.fillText(accentText, 0, accentY);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  ctx.shadowColor = 'rgba(255, 45, 120, 0.9)';
  ctx.shadowBlur = titleSize * 0.22;
  ctx.shadowOffsetX = titleSize * 0.05;
  ctx.shadowOffsetY = titleSize * 0.06;
  ctx.lineWidth = Math.max(3, titleSize * 0.09);
  ctx.strokeStyle = '#000000';
  ctx.lineJoin = 'round';
  // Re-assert the Anton font: the accent block above switched ctx.font to Pacifico.
  ctx.font = `${titleSize}px Anton, 'Arial Black', sans-serif`;
  lines.forEach((line, i) => {
    const y = -((lines.length - 1 - i) * lineHeight);
    ctx.strokeText(line, 0, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line, 0, y);
  });
  ctx.restore();

  // 9. Deterministic film grain: ~800 tiny dots, seeded, low alpha.
  const rand = seededRandom(1337 + w * 7 + h * 13);
  ctx.save();
  for (let i = 0; i < 800; i++) {
    const gx = rand() * w;
    const gy = rand() * h;
    const bright = rand() > 0.5;
    ctx.fillStyle = bright ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)';
    ctx.fillRect(gx, gy, 1.4, 1.4);
  }
  ctx.restore();
}
