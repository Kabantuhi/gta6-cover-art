// Neon Coast Cover Studio — cover renderer.
// A plain canvas engine (no dependencies): given a state object and loaded
// photos, it paints a GTA-style multi-panel poster. The editor (main.js) and
// the PNG exporter both call drawCover; nothing here touches the network.

(function () {
  'use strict';

  // ---------------------------------------------------------------- grades

  var GRADES = {
    sunset: { name: 'Sunset', wash: '#ff7a3c', blend: 'overlay', strength: 0.5, swatch: 'linear-gradient(135deg,#ff9a3c,#ff2e63)' },
    neon: { name: 'Neon Nights', wash: '#7a5cff', blend: 'overlay', strength: 0.5, swatch: 'linear-gradient(135deg,#7a5cff,#2dd4ff)' },
    vice: { name: 'Vice Pink', wash: '#ff2e88', blend: 'soft-light', strength: 0.6, swatch: 'linear-gradient(135deg,#ff2e88,#b388ff)' },
    teal: { name: 'Teal Dusk', wash: '#19c2b8', blend: 'overlay', strength: 0.45, swatch: 'linear-gradient(135deg,#19c2b8,#2b6cb0)' },
    golden: { name: 'Golden Hour', wash: '#ffb03a', blend: 'soft-light', strength: 0.55, swatch: 'linear-gradient(135deg,#ffd166,#ff7a3c)' },
  };

  var GRADE_ORDER = ['sunset', 'neon', 'vice', 'teal', 'golden'];

  // ---------------------------------------------------------------- layouts

  // Every layout returns panels in unit coordinates (0..1 of the canvas) and
  // a caption zone: either a title block cell ('block') or an overlay band
  // across the bottom ('overlay'). Panels carry an optional rotation (for the
  // tilted snapshots) or a polygon clip (for the diagonal duo).
  var LAYOUTS = {
    grid: {
      name: 'Four-panel grid',
      panels: function () {
        var g = 0.014, c = (1 - g) / 2;
        return [
          { x: 0, y: 0, w: c, h: c },
          { x: c + g, y: 0, w: c, h: c },
          { x: 0, y: c + g, w: c, h: c },
          { x: c + g, y: c + g, w: c, h: c },
        ];
      },
      caption: { mode: 'overlay' },
    },
    hero: {
      name: 'Hero + three',
      panels: function () {
        var g = 0.014, right = 0.372, third = (1 - g * 2) / 3;
        return [
          { x: 0, y: 0, w: 1 - right - g, h: 1 },
          { x: 1 - right, y: 0, w: right, h: third },
          { x: 1 - right, y: third + g, w: right, h: third },
          { x: 1 - right, y: (third + g) * 2, w: right, h: third },
        ];
      },
      caption: { mode: 'overlay' },
    },
    full: {
      name: 'Full bleed',
      panels: function () {
        return [{ x: 0, y: 0, w: 1, h: 1 }];
      },
      caption: { mode: 'overlay' },
    },
    nine: {
      name: 'Nine-panel grid',
      panels: function () {
        var g = 0.012, c = (1 - g * 2) / 3, out = [];
        for (var r = 0; r < 3; r++) {
          for (var col = 0; col < 3; col++) {
            if (r === 1 && col === 1) continue; // the title block lives here
            out.push({ x: col * (c + g), y: r * (c + g), w: c, h: c });
          }
        }
        return out;
      },
      caption: { mode: 'block', x: (1 - 0.012 * 2) / 3 + 0.012, y: (1 - 0.012 * 2) / 3 + 0.012, w: (1 - 0.012 * 2) / 3, h: (1 - 0.012 * 2) / 3 },
    },
    tilted: {
      name: 'Tilted snapshot',
      panels: function () {
        return [
          { x: 0.06, y: 0.06, w: 0.44, h: 0.58, rot: -0.12, frame: 'polaroid' },
          { x: 0.3, y: 0.1, w: 0.44, h: 0.58, rot: 0.02, frame: 'polaroid' },
          { x: 0.52, y: 0.05, w: 0.44, h: 0.58, rot: 0.11, frame: 'polaroid' },
        ];
      },
      caption: { mode: 'overlay' },
    },
    duo: {
      name: 'Diagonal duo',
      panels: function () {
        return [
          { x: 0, y: 0, w: 0.62, h: 1, poly: [[0, 0], [0.62, 0], [0.38, 1], [0, 1]] },
          { x: 0.38, y: 0, w: 0.62, h: 1, poly: [[0.62, 0], [1, 0], [1, 1], [0.38, 1]] },
        ];
      },
      caption: { mode: 'overlay' },
    },
  };

  var LAYOUT_ORDER = ['grid', 'hero', 'full', 'nine', 'tilted', 'duo'];

  // ---------------------------------------------------------------- helpers

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var grainTile = null;
  function getGrainTile() {
    if (grainTile) return grainTile;
    var rnd = mulberry32(20261119);
    var tile = document.createElement('canvas');
    tile.width = 160; tile.height = 160;
    var tctx = tile.getContext('2d');
    var img = tctx.createImageData(160, 160);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = Math.floor(rnd() * 255);
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    tctx.putImageData(img, 0, 0);
    grainTile = tile;
    return tile;
  }

  // Shrink a font until the text fits maxWidth; returns the size used.
  function fitFont(ctx, text, family, startSize, maxWidth) {
    var size = startSize;
    while (size > 8) {
      ctx.font = size + 'px ' + family;
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 2;
    }
    ctx.font = size + 'px ' + family;
    return size;
  }

  function tracePanelPath(ctx, p, W, H) {
    ctx.beginPath();
    if (p.poly) {
      p.poly.forEach(function (pt, i) {
        var x = pt[0] * W, y = pt[1] * H;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
    } else {
      ctx.rect(p.x * W, p.y * H, p.w * W, p.h * H);
    }
  }

  // Draw one photo into a clipped panel rect, cover-fitting it and applying
  // the panel's pan (x, y in panel widths), zoom and rotation.
  function paintPhoto(ctx, img, rect, place, W, H) {
    var pw = rect.w, ph = rect.h;
    var base = Math.max(pw / img.naturalWidth, ph / img.naturalHeight) * (place.zoom || 1);
    var dw = img.naturalWidth * base, dh = img.naturalHeight * base;
    var maxX = Math.max(0, (dw - pw) / 2), maxY = Math.max(0, (dh - ph) / 2);
    var ox = Math.max(-maxX, Math.min(maxX, (place.x || 0) * pw));
    var oy = Math.max(-maxY, Math.min(maxY, (place.y || 0) * ph));
    ctx.save();
    ctx.translate(rect.x + pw / 2 + ox, rect.y + ph / 2 + oy);
    ctx.rotate(place.rot || 0);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  function paintGradeWash(ctx, grade, clipRect) {
    ctx.save();
    ctx.globalCompositeOperation = grade.blend;
    ctx.globalAlpha = grade.strength;
    ctx.fillStyle = grade.wash;
    ctx.fillRect(clipRect.x, clipRect.y, clipRect.w, clipRect.h);
    ctx.restore();
  }

  function paintCaptionText(ctx, state, cx, titleY, subY, starY, titleSize, W) {
    var title = (state.title || '').toUpperCase();
    var sub = state.subtitle || '';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (title) {
      var ts = fitFont(ctx, title, 'Anton, "Arial Narrow", sans-serif', titleSize, W * 0.94);
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = ts * 0.06;
      ctx.shadowOffsetY = ts * 0.035;
      ctx.strokeStyle = 'rgba(8,2,18,0.92)';
      ctx.lineWidth = Math.max(2, ts * 0.09);
      ctx.strokeText(title, cx, titleY);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(title, cx, titleY);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    if (sub) {
      var ss = Math.max(12, titleSize * 0.42);
      ctx.font = ss + 'px Pacifico, cursive';
      ctx.shadowColor = '#ff2e88';
      ctx.shadowBlur = Math.max(8, ss * 0.45);
      ctx.fillStyle = '#ff5da2';
      ctx.fillText(sub, cx, subY);
      ctx.shadowBlur = 0;
    }
    var stars = Math.max(0, Math.min(5, state.stars | 0));
    var starSize = Math.max(12, titleSize * 0.3);
    ctx.font = starSize + 'px "DejaVu Sans", sans-serif';
    var filled = '';
    for (var i = 0; i < 5; i++) filled += i < stars ? '★' : '☆';
    ctx.fillStyle = '#ffc93c';
    ctx.fillText(filled, cx, starY);
  }

  function paintRibbon(ctx, badge, W, H) {
    if (!badge) return;
    var text = String(badge).toUpperCase();
    var fontSize = Math.max(14, W * 0.032);
    ctx.font = fontSize + 'px Anton, "Arial Narrow", sans-serif';
    var tw = ctx.measureText(text).width;
    var bandLen = tw + fontSize * 2.4;
    var bandH = fontSize * 1.9;
    var pad = bandLen * 0.3;
    ctx.save();
    ctx.translate(W - pad, pad);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#ff2e88';
    ctx.fillRect(-bandLen / 2, -bandH / 2, bandLen, bandH);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 1);
    ctx.restore();
  }

  function paintGrain(ctx, W, H) {
    var tile = getGrainTile();
    var pattern = ctx.createPattern(tile, 'repeat');
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function paintVignette(ctx, W, H) {
    var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(5,0,15,0)');
    g.addColorStop(1, 'rgba(5,0,15,0.42)');
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ---------------------------------------------------------------- drawing

  function drawCover(canvas, state, images) {
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var layout = LAYOUTS[state.layout] || LAYOUTS.grid;
    var grade = GRADES[state.grade] || GRADES.sunset;
    var panels = layout.panels();
    var photoAt = function (slot) {
      var place = state.panels[slot] || {};
      var entry = state.photos[place.photo | 0];
      return entry ? images[entry.id] || null : null;
    };

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#150829';
    ctx.fillRect(0, 0, W, H);

    panels.forEach(function (p, slot) {
      var img = photoAt(slot);
      var rect = { x: p.x * W, y: p.y * H, w: p.w * W, h: p.h * H };
      var place = state.panels[slot] || {};
      if (p.frame === 'polaroid') {
        ctx.save();
        ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = '#f8f4ec';
        ctx.fillRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
        var inner = {
          x: -rect.w / 2 + rect.w * 0.045,
          y: -rect.h / 2 + rect.h * 0.045,
          w: rect.w * 0.91,
          h: rect.h * 0.78,
        };
        ctx.save();
        ctx.beginPath();
        ctx.rect(inner.x, inner.y, inner.w, inner.h);
        ctx.clip();
        if (img) paintPhoto(ctx, img, inner, place, W, H);
        paintGradeWash(ctx, grade, inner);
        ctx.restore();
        ctx.restore();
        return;
      }
      ctx.save();
      tracePanelPath(ctx, p, W, H);
      ctx.clip();
      if (img) paintPhoto(ctx, img, rect, place, W, H);
      paintGradeWash(ctx, grade, rect);
      ctx.restore();
      ctx.save();
      tracePanelPath(ctx, p, W, H);
      ctx.strokeStyle = 'rgba(8,2,18,0.55)';
      ctx.lineWidth = Math.max(2, W * 0.004);
      ctx.stroke();
      ctx.restore();
    });

    var cap = layout.caption;
    if (cap.mode === 'block') {
      var bx = cap.x * W, by = cap.y * H, bw = cap.w * W, bh = cap.h * H;
      ctx.fillStyle = '#1c0e3e';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = Math.max(1, W * 0.002);
      ctx.strokeRect(bx, by, bw, bh);
      paintCaptionText(ctx, state, bx + bw / 2, by + bh * 0.34, by + bh * 0.62, by + bh * 0.85, bw * 0.24, W);
    } else {
      var grad = ctx.createLinearGradient(0, H * 0.6, 0, H);
      grad.addColorStop(0, 'rgba(8,2,18,0)');
      grad.addColorStop(1, 'rgba(8,2,18,0.62)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, H * 0.6, W, H * 0.4);
      paintCaptionText(ctx, state, W / 2, H * 0.8, H * 0.885, H * 0.945, W * 0.11, W);
    }

    paintRibbon(ctx, state.badge, W, H);
    if (state.grain) paintGrain(ctx, W, H);
    if (state.vignette) paintVignette(ctx, W, H);
  }

  function renderToSize(state, images, w, h) {
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    drawCover(canvas, state, images);
    return canvas;
  }

  window.CoverArt = {
    GRADES: GRADES,
    GRADE_ORDER: GRADE_ORDER,
    LAYOUTS: LAYOUTS,
    LAYOUT_ORDER: LAYOUT_ORDER,
    drawCover: drawCover,
    renderToSize: renderToSize,
  };
})();
