// Neon Coast Cover Studio — cover rendering engine (round 4 build).
// Layout math, DOM cover builder and canvas exporter. No network access:
// fonts and photos are local files served with the app.
(function () {
  'use strict';

  var GAP = 0.012; // gap between panels, as a fraction of cover width

  var LAYOUTS = [
    { id: 'four', name: 'Four-panel grid', slots: 4 },
    { id: 'hero', name: 'Hero + three', slots: 4 },
    { id: 'bleed', name: 'Full bleed', slots: 1 },
    { id: 'nine', name: 'Nine-panel grid', slots: 8 },
    { id: 'tilt', name: 'Tilted snapshot', slots: 2 },
    { id: 'duo', name: 'Diagonal duo', slots: 2 },
  ];

  var GRADES = [
    { id: 'sunset', name: 'Sunset', filter: 'sepia(0.32) saturate(1.45) contrast(1.06) brightness(1.02)', tint: '#ff7a18', tintAlpha: 0.10, blend: 'overlay' },
    { id: 'neon', name: 'Neon Nights', filter: 'saturate(1.65) hue-rotate(-18deg) contrast(1.08)', tint: '#7b2fff', tintAlpha: 0.14, blend: 'overlay' },
    { id: 'vice', name: 'Vice Pink', filter: 'saturate(1.55) hue-rotate(28deg) contrast(1.05)', tint: '#ff2e9a', tintAlpha: 0.12, blend: 'overlay' },
    { id: 'teal', name: 'Teal Dusk', filter: 'saturate(1.35) hue-rotate(155deg) brightness(0.98)', tint: '#00c2a8', tintAlpha: 0.10, blend: 'overlay' },
    { id: 'golden', name: 'Golden Hour', filter: 'sepia(0.45) saturate(1.5) brightness(1.06)', tint: '#ffb400', tintAlpha: 0.12, blend: 'soft-light' },
  ];

  var SIZES = [
    { id: '1080x1080', label: '1080 × 1080', w: 1080, h: 1080 },
    { id: '1080x1350', label: '1080 × 1350', w: 1080, h: 1350 },
    { id: '1920x1080', label: '1920 × 1080', w: 1920, h: 1080 },
    { id: '1080x1920', label: '1080 × 1920', w: 1080, h: 1920 },
  ];

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  }
  function gradeById(id) { return byId(GRADES, id); }
  function layoutById(id) { return byId(LAYOUTS, id); }
  function sizeById(id) { return byId(SIZES, id); }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function starString(n) {
    var s = '';
    for (var i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    return s;
  }

  // Panel rects for a layout, in pixels, inside a cover of w x h.
  // A rect is {x, y, w, h} plus, for tilt, {rot, frame}; for duo, {poly}.
  function layoutRects(layoutId, w, h) {
    var g = Math.round(w * GAP);
    var rects = [];
    if (layoutId === 'four') {
      var cw = (w - g) / 2, ch = (h - g) / 2;
      rects = [
        { x: 0, y: 0, w: cw, h: ch },
        { x: cw + g, y: 0, w: cw, h: ch },
        { x: 0, y: ch + g, w: cw, h: ch },
        { x: cw + g, y: ch + g, w: cw, h: ch },
      ];
    } else if (layoutId === 'hero') {
      var lw = Math.round(w * 0.62), rw = w - lw - g;
      var rh = (h - 2 * g) / 3;
      rects = [
        { x: 0, y: 0, w: lw, h: h },
        { x: lw + g, y: 0, w: rw, h: rh },
        { x: lw + g, y: rh + g, w: rw, h: rh },
        { x: lw + g, y: 2 * (rh + g), w: rw, h: rh },
      ];
    } else if (layoutId === 'bleed') {
      rects = [{ x: 0, y: 0, w: w, h: h }];
    } else if (layoutId === 'nine') {
      var cw3 = (w - 2 * g) / 3, ch3 = (h - 2 * g) / 3;
      var xs = [0, cw3 + g, 2 * (cw3 + g)], ys = [0, ch3 + g, 2 * (ch3 + g)];
      var order = [0, 1, 2, 3, 5, 6, 7, 8]; // every cell except the centre
      order.forEach(function (cell) {
        var cx = cell % 3, cy = Math.floor(cell / 3);
        rects.push({ x: xs[cx], y: ys[cy], w: cw3, h: ch3 });
      });
    } else if (layoutId === 'tilt') {
      rects = [
        { x: w * 0.07, y: h * 0.08, w: w * 0.44, h: h * 0.54, rot: -4, frame: true },
        { x: w * 0.49, y: h * 0.34, w: w * 0.44, h: h * 0.54, rot: 3, frame: true },
      ];
    } else if (layoutId === 'duo') {
      rects = [
        { x: 0, y: 0, w: w, h: h, poly: [[0, 0], [w * 0.64, 0], [w * 0.36, h], [0, h]] },
        { x: 0, y: 0, w: w, h: h, poly: [[w * 0.64, 0], [w, 0], [w, h], [w * 0.36, h]] },
      ];
    }
    return rects;
  }

  // Title zone, as fractions of the cover. Nine-panel uses the centre cell
  // as its title block; every other layout overlays a band at the bottom.
  function titleZone(layoutId) {
    if (layoutId === 'nine') return { x: 1 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3 };
    return { x: 0, y: 0.68, w: 1, h: 0.32 };
  }

  // Inner photo area of a tilted polaroid frame, relative to the frame.
  function tiltInner(rect) {
    var padX = rect.w * 0.05, padTop = rect.h * 0.05, padBottom = rect.h * 0.16;
    return { x: padX, y: padTop, w: rect.w - 2 * padX, h: rect.h - padTop - padBottom };
  }

  // Where an image lands inside a slot, given a crop {dx, dy, zoom}.
  // dx/dy are fractions of the slot size, zoom is >= 1. Returns offsets and
  // size relative to the slot's top-left corner.
  function cropBox(slot, img, crop) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    var base = Math.max(slot.w / iw, slot.h / ih);
    var dw = iw * base * crop.zoom;
    var dh = ih * base * crop.zoom;
    return {
      x: (slot.w - dw) / 2 + (crop.dx || 0) * slot.w,
      y: (slot.h - dh) / 2 + (crop.dy || 0) * slot.h,
      w: dw, h: dh,
    };
  }

  // Keep a crop covering its slot after a drag or a zoom.
  function clampCrop(slot, img, crop) {
    crop.zoom = clamp(crop.zoom || 1, 1, 3);
    var box = cropBox(slot, img, crop);
    var mx = box.w > slot.w ? (box.w - slot.w) / (2 * slot.w) : 0;
    var my = box.h > slot.h ? (box.h - slot.h) / (2 * slot.h) : 0;
    crop.dx = clamp(crop.dx || 0, -mx, mx);
    crop.dy = clamp(crop.dy || 0, -my, my);
    return crop;
  }

  // Position a slot's <img> from its crop (DOM preview path). ox/oy shift
  // the image inside a frame (tilted polaroids).
  function positionSlotImg(imgEl, slot, img, crop, ox, oy) {
    var box = cropBox(slot, img, crop);
    imgEl.style.left = ((ox || 0) + box.x) + 'px';
    imgEl.style.top = ((oy || 0) + box.y) + 'px';
    imgEl.style.width = box.w + 'px';
    imgEl.style.height = box.h + 'px';
  }

  // One shared film-grain tile, drawn once and reused by DOM and canvas.
  var _noiseCanvas = null;
  function noiseCanvas() {
    if (_noiseCanvas) return _noiseCanvas;
    var c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    var x = c.getContext('2d');
    var d = x.createImageData(128, 128);
    for (var i = 0; i < d.data.length; i += 4) {
      var v = (Math.random() * 255) | 0;
      d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v;
      d.data[i + 3] = (Math.random() * 26) | 0;
    }
    x.putImageData(d, 0, 0);
    _noiseCanvas = c;
    return c;
  }
  function noiseURL() { return noiseCanvas().toDataURL('image/png'); }

  // Largest Anton size that fits `text` inside maxWidth, shrinking from
  // startPx. Uses an offscreen canvas so DOM and export agree.
  var _measure = null;
  function fitTitleSize(text, startPx, maxWidth) {
    if (!_measure) _measure = document.createElement('canvas').getContext('2d');
    var size = startPx;
    while (size > 10) {
      _measure.font = size + 'px Anton, sans-serif';
      if (_measure.measureText(text).width <= maxWidth) break;
      size -= 2;
    }
    return size;
  }

  function px(v) { return Math.round(v) + 'px'; }

  // Build the cover DOM inside `mount` (which must already be sized).
  function buildCover(state, images, mount, selected) {
    var w = mount.clientWidth || 720;
    var h = mount.clientHeight || 720;
    var cover = document.createElement('div');
    cover.className = 'cover';
    cover.style.width = px(w);
    cover.style.height = px(h);
    var grade = gradeById(state.grade);
    var rects = layoutRects(state.layout, w, h);

    if (state.layout === 'tilt') {
      var bg = images.get(state.assign[0] ? state.assign[0].photo : null);
      if (bg) {
        var bgEl = document.createElement('div');
        bgEl.className = 'cover-bg';
        var bgImg = document.createElement('img');
        bgImg.src = bg.src;
        bgImg.style.filter = grade.filter;
        positionSlotImg(bgImg, { w: w, h: h }, bg, { dx: 0, dy: 0, zoom: 1.15 });
        bgEl.appendChild(bgImg);
        cover.appendChild(bgEl);
      }
    }

    rects.forEach(function (rect, i) {
      var assign = state.assign[i] || { photo: null, dx: 0, dy: 0, zoom: 1 };
      var img = images.get(assign.photo);
      if (!img) return;
      if (rect.frame) {
        var frame = document.createElement('div');
        frame.className = 'slot frame';
        frame.dataset.slot = String(i);
        frame.style.left = px(rect.x);
        frame.style.top = px(rect.y);
        frame.style.width = px(rect.w);
        frame.style.height = px(rect.h);
        frame.style.transform = 'rotate(' + rect.rot + 'deg)';
        var inner = tiltInner(rect);
        var photo = document.createElement('img');
        photo.src = img.src;
        photo.style.filter = grade.filter;
        positionSlotImg(photo, inner, img, assign, inner.x, inner.y);
        frame.appendChild(photo);
        if (selected === i) frame.classList.add('selected');
        cover.appendChild(frame);
        return;
      }
      var slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.slot = String(i);
      slot.style.left = px(rect.x);
      slot.style.top = px(rect.y);
      slot.style.width = px(rect.w);
      slot.style.height = px(rect.h);
      if (rect.poly) {
        slot.style.clipPath = 'polygon(' + rect.poly.map(function (p) {
          return (p[0] / w * 100).toFixed(2) + '% ' + (p[1] / h * 100).toFixed(2) + '%';
        }).join(', ') + ')';
      }
      var photoEl = document.createElement('img');
      photoEl.src = img.src;
      photoEl.style.filter = grade.filter;
      var slotBox = rect.poly ? { w: w, h: h } : rect;
      positionSlotImg(photoEl, slotBox, img, assign);
      slot.appendChild(photoEl);
      if (selected === i) slot.classList.add('selected');
      cover.appendChild(slot);
    });

    // Colour grade tint over the whole cover.
    var tint = document.createElement('div');
    tint.className = 'cover-tint';
    tint.style.background = grade.tint;
    tint.style.opacity = String(grade.tintAlpha);
    tint.style.mixBlendMode = grade.blend;
    cover.appendChild(tint);

    // Title block.
    var zone = titleZone(state.layout);
    var zx = zone.x * w, zy = zone.y * h, zw = zone.w * w, zh = zone.h * h;
    var titleEl = document.createElement('div');
    titleEl.className = 'cover-title ' + (state.layout === 'nine' ? 'cell' : 'band');
    titleEl.style.left = px(zx);
    titleEl.style.top = px(zy);
    titleEl.style.width = px(zw);
    titleEl.style.height = px(zh);
    var tSize = fitTitleSize(state.title, Math.floor(zw * 0.17), zw * 0.94);
    var h1 = document.createElement('div');
    h1.className = 'cover-title-text';
    h1.textContent = state.title;
    h1.style.fontSize = px(tSize);
    var sub = document.createElement('div');
    sub.className = 'cover-subtitle';
    sub.textContent = state.subtitle;
    sub.style.fontSize = px(Math.floor(tSize * 0.52));
    var stars = document.createElement('div');
    stars.className = 'cover-stars';
    stars.textContent = starString(state.stars);
    stars.style.fontSize = px(Math.floor(tSize * 0.34));
    titleEl.appendChild(h1);
    titleEl.appendChild(sub);
    titleEl.appendChild(stars);
    cover.appendChild(titleEl);

    // Ribbon across the top-right corner. Its centre sits a little inside
    // the corner (not on it), so the band and its text stay visible
    // instead of hanging mostly off the canvas.
    if (state.ribbon) {
      var ribbon = document.createElement('div');
      ribbon.className = 'cover-ribbon';
      var rw = Math.floor(w * 0.42);
      var bh = Math.max(16, Math.floor(w * 0.045));
      var rs = rw * 0.18;
      ribbon.style.width = px(rw);
      ribbon.style.left = px(w - rs - rw / 2);
      ribbon.style.top = px(rs - bh / 2);
      ribbon.style.padding = px(Math.max(4, Math.floor(w * 0.008))) + ' 0';
      ribbon.style.fontSize = px(Math.max(12, Math.floor(w * 0.028)));
      ribbon.style.transform = 'rotate(45deg)';
      var span = document.createElement('span');
      span.textContent = 'LAUNCH WEEK';
      ribbon.appendChild(span);
      cover.appendChild(ribbon);
    }

    if (state.grain) {
      var grain = document.createElement('div');
      grain.className = 'cover-grain';
      grain.style.backgroundImage = 'url(' + noiseURL() + ')';
      cover.appendChild(grain);
    }
    if (state.vignette) {
      var vig = document.createElement('div');
      vig.className = 'cover-vignette';
      cover.appendChild(vig);
    }

    mount.innerHTML = '';
    mount.appendChild(cover);
    return cover;
  }

  // Draw the cover onto a canvas at exact export size.
  function renderToCanvas(state, images, w, h) {
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#150a2e';
    ctx.fillRect(0, 0, w, h);
    var grade = gradeById(state.grade);
    var rects = layoutRects(state.layout, w, h);

    if (state.layout === 'tilt') {
      var bg = images.get(state.assign[0] ? state.assign[0].photo : null);
      if (bg) {
        ctx.save();
        ctx.filter = grade.filter;
        ctx.globalAlpha = 0.55;
        var b = cropBox({ w: w, h: h }, bg, { dx: 0, dy: 0, zoom: 1.15 });
        ctx.drawImage(bg, b.x, b.y, b.w, b.h);
        ctx.restore();
      }
    }

    rects.forEach(function (rect, i) {
      var assign = state.assign[i] || { photo: null, dx: 0, dy: 0, zoom: 1 };
      var img = images.get(assign.photo);
      if (!img) return;
      ctx.save();
      if (rect.frame) {
        var cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
        ctx.translate(cx, cy);
        ctx.rotate(rect.rot * Math.PI / 180);
        ctx.fillStyle = '#fdf8ef';
        ctx.fillRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
        var inner = tiltInner(rect);
        ctx.beginPath();
        ctx.rect(-rect.w / 2 + inner.x, -rect.h / 2 + inner.y, inner.w, inner.h);
        ctx.clip();
        ctx.filter = grade.filter;
        var box = cropBox(inner, img, assign);
        ctx.drawImage(img, -rect.w / 2 + inner.x + box.x, -rect.h / 2 + inner.y + box.y, box.w, box.h);
        ctx.restore();
        return;
      }
      if (rect.poly) {
        ctx.beginPath();
        rect.poly.forEach(function (p, k) {
          if (k === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        });
        ctx.closePath();
        ctx.clip();
        ctx.filter = grade.filter;
        var boxP = cropBox({ w: w, h: h }, img, assign);
        ctx.drawImage(img, boxP.x, boxP.y, boxP.w, boxP.h);
        ctx.restore();
        return;
      }
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();
      ctx.filter = grade.filter;
      var box2 = cropBox(rect, img, assign);
      ctx.drawImage(img, rect.x + box2.x, rect.y + box2.y, box2.w, box2.h);
      ctx.restore();
    });

    // Diagonal seam for the duo layout.
    if (state.layout === 'duo') {
      ctx.save();
      ctx.strokeStyle = '#150a2e';
      ctx.lineWidth = Math.max(4, w * 0.006);
      ctx.beginPath();
      ctx.moveTo(w * 0.64, 0);
      ctx.lineTo(w * 0.36, h);
      ctx.stroke();
      ctx.restore();
    }

    // Colour grade tint over the whole cover.
    ctx.save();
    ctx.globalCompositeOperation = grade.blend;
    ctx.globalAlpha = grade.tintAlpha;
    ctx.fillStyle = grade.tint;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Title block.
    var zone = titleZone(state.layout);
    var zx = zone.x * w, zy = zone.y * h, zw = zone.w * w, zh = zone.h * h;
    if (state.layout === 'nine') {
      ctx.fillStyle = '#150a2e';
      ctx.fillRect(zx, zy, zw, zh);
    } else {
      var grad = ctx.createLinearGradient(0, zy, 0, zy + zh);
      grad.addColorStop(0, 'rgba(10,2,28,0)');
      grad.addColorStop(1, 'rgba(10,2,28,0.62)');
      ctx.fillStyle = grad;
      ctx.fillRect(zx, zy, zw, zh);
    }
    var tSize = fitTitleSize(state.title, Math.floor(zw * 0.17), zw * 0.94);
    var cxT = zx + zw / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = tSize + 'px Anton, sans-serif';
    ctx.lineWidth = Math.max(2, tSize * 0.09);
    ctx.strokeStyle = '#0a021c';
    ctx.lineJoin = 'round';
    var titleY = zy + zh * 0.36;
    ctx.strokeText(state.title, cxT, titleY);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(state.title, cxT, titleY);
    var subSize = Math.floor(tSize * 0.52);
    ctx.font = subSize + 'px Pacifico, cursive';
    ctx.shadowColor = '#ff2e9a';
    ctx.shadowBlur = subSize * 0.5;
    ctx.fillStyle = '#ff5db1';
    ctx.fillText(state.subtitle, cxT, zy + zh * 0.64);
    ctx.shadowBlur = 0;
    var starSize = Math.floor(tSize * 0.34);
    ctx.font = starSize + 'px Anton, sans-serif';
    ctx.fillStyle = '#ffc93c';
    ctx.fillText(starString(state.stars), cxT, zy + zh * 0.86);

    // Ribbon across the top-right corner, centred a little inside it so
    // the band and its text stay visible.
    if (state.ribbon) {
      var bw = w * 0.42, bh = Math.max(20, w * 0.045);
      var bs = bw * 0.18;
      ctx.save();
      ctx.translate(w - bs, bs);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ff2e7e';
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      ctx.fillStyle = '#ffffff';
      ctx.font = Math.floor(bh * 0.5) + 'px Anton, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LAUNCH WEEK', 0, 1);
      ctx.restore();
    }

    if (state.grain) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = ctx.createPattern(noiseCanvas(), 'repeat');
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    if (state.vignette) {
      var vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72);
      vg.addColorStop(0, 'rgba(8,0,24,0)');
      vg.addColorStop(1, 'rgba(8,0,24,0.55)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    }
    return canvas;
  }

  function exportPNG(state, images, w, h) {
    var canvas = renderToCanvas(state, images, w, h);
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('canvas export produced no blob'));
      }, 'image/png');
    });
  }

  window.NeonCoast = {
    LAYOUTS: LAYOUTS,
    GRADES: GRADES,
    SIZES: SIZES,
    layoutById: layoutById,
    gradeById: gradeById,
    sizeById: sizeById,
    layoutRects: layoutRects,
    titleZone: titleZone,
    tiltInner: tiltInner,
    cropBox: cropBox,
    clampCrop: clampCrop,
    positionSlotImg: positionSlotImg,
    noiseURL: noiseURL,
    fitTitleSize: fitTitleSize,
    starString: starString,
    buildCover: buildCover,
    renderToCanvas: renderToCanvas,
    exportPNG: exportPNG,
  };
})();
