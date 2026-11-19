// Neon Coast Cover Studio — editor.
// Owns the state, the controls, panel dragging and zooming, undo/redo, PNG
// export and the ?shot= mode the screenshot driver uses. Everything runs
// offline: photos are read from the machine, nothing is uploaded.

(function () {
  'use strict';

  var SAMPLES = [
    { id: 'pier', name: 'Pier', src: 'samples/pier.jpg' },
    { id: 'boulevard', name: 'Boulevard', src: 'samples/boulevard.jpg' },
  ];

  var EXPORT_SIZES = ['1080x1080', '1080x1350', '1920x1080', '1080x1920'];

  function defaultPanels() {
    var out = [];
    for (var i = 0; i < 9; i++) out.push({ photo: 0, x: 0, y: 0, zoom: 1, rot: 0 });
    return out;
  }

  function defaultState() {
    return {
      layout: 'nine',
      grade: 'neon',
      grain: true,
      vignette: true,
      title: 'Neon Shore',
      subtitle: 'Night Drive',
      badge: 'LAUNCH WEEK',
      stars: 4,
      exportSize: '1080x1080',
      photos: SAMPLES.slice(),
      panels: defaultPanels(),
    };
  }

  var state = defaultState();
  var images = {}; // photo id -> loaded HTMLImageElement
  var selected = 0;
  var undoStack = [];
  var redoStack = [];
  var stage = null;
  var drag = null;

  // ---------------------------------------------------------------- photos

  function loadImage(entry) {
    if (images[entry.id]) return Promise.resolve(images[entry.id]);
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { images[entry.id] = img; resolve(img); };
      img.onerror = function () { reject(new Error('cannot load ' + entry.src)); };
      img.src = entry.src;
    });
  }

  function loadAllPhotos() {
    return Promise.all(state.photos.map(loadImage));
  }

  // ---------------------------------------------------------------- history

  function snapshot() {
    return JSON.parse(JSON.stringify({
      layout: state.layout,
      grade: state.grade,
      grain: state.grain,
      vignette: state.vignette,
      title: state.title,
      subtitle: state.subtitle,
      badge: state.badge,
      stars: state.stars,
      exportSize: state.exportSize,
      panels: state.panels,
    }));
  }

  function restore(snap) {
    state.layout = snap.layout;
    state.grade = snap.grade;
    state.grain = snap.grain;
    state.vignette = snap.vignette;
    state.title = snap.title;
    state.subtitle = snap.subtitle;
    state.badge = snap.badge;
    state.stars = snap.stars;
    state.exportSize = snap.exportSize;
    state.panels = snap.panels;
    syncControls();
    render();
  }

  function pushHistory() {
    undoStack.push(snapshot());
    if (undoStack.length > 60) undoStack.shift();
    redoStack.length = 0;
    syncUndoButtons();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
    syncUndoButtons();
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
    syncUndoButtons();
  }

  // ---------------------------------------------------------------- render

  function sizeOf(label) {
    var parts = label.split('x');
    return { w: parseInt(parts[0], 10), h: parseInt(parts[1], 10) };
  }

  function render() {
    if (!stage) return;
    var size = sizeOf(state.exportSize);
    if (stage.width !== size.w || stage.height !== size.h) {
      stage.width = size.w;
      stage.height = size.h;
    }
    window.CoverArt.drawCover(stage, state, images);
  }

  function renderOffscreen(label) {
    var size = sizeOf(label);
    return window.CoverArt.renderToSize(state, images, size.w, size.h);
  }

  // ---------------------------------------------------------------- export

  function exportDataURL(label) {
    return renderOffscreen(label).toDataURL('image/png');
  }

  function downloadPNG(label) {
    var canvas = renderOffscreen(label);
    canvas.toBlob(function (blob) {
      if (!blob) return;
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'neon-coast-cover-' + label + '.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 400);
    }, 'image/png');
  }

  function exportAll() {
    EXPORT_SIZES.forEach(function (label, i) {
      setTimeout(function () { downloadPNG(label); }, i * 350);
    });
  }

  // ---------------------------------------------------------------- controls

  function el(id) { return document.getElementById(id); }

  function buildButtons(containerId, items, active, onPick) {
    var box = el(containerId);
    box.innerHTML = '';
    items.forEach(function (item) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick' + (item.id === active ? ' on' : '');
      b.textContent = item.label;
      if (item.swatch) b.style.background = item.swatch;
      b.addEventListener('click', function () { onPick(item.id); });
      box.appendChild(b);
    });
  }

  function buildStars() {
    var box = el('stars');
    box.innerHTML = '';
    for (var i = 1; i <= 5; i++) {
      (function (n) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'star' + (n <= state.stars ? ' lit' : '');
        b.textContent = n <= state.stars ? '★' : '☆';
        b.setAttribute('aria-label', n + ' stars');
        b.addEventListener('click', function () {
          pushHistory();
          state.stars = n;
          buildStars();
          render();
        });
        box.appendChild(b);
      })(i);
    }
  }

  function buildTray() {
    var box = el('tray');
    box.innerHTML = '';
    state.photos.forEach(function (photo, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'thumb';
      var img = document.createElement('img');
      img.src = photo.src;
      img.alt = photo.name;
      b.appendChild(img);
      var label = document.createElement('span');
      label.textContent = photo.name;
      b.appendChild(label);
      b.addEventListener('click', function () {
        pushHistory();
        state.panels[selected].photo = i;
        render();
      });
      box.appendChild(b);
    });
  }

  function syncControls() {
    buildButtons('layout-picks', window.CoverArt.LAYOUT_ORDER.map(function (id) {
      return { id: id, label: window.CoverArt.LAYOUTS[id].name };
    }), state.layout, function (id) {
      pushHistory();
      state.layout = id;
      selected = 0;
      syncControls();
      render();
    });
    buildButtons('grade-picks', window.CoverArt.GRADE_ORDER.map(function (id) {
      var g = window.CoverArt.GRADES[id];
      return { id: id, label: g.name, swatch: g.swatch };
    }), state.grade, function (id) {
      pushHistory();
      state.grade = id;
      syncControls();
      render();
    });
    buildButtons('size-picks', EXPORT_SIZES.map(function (s) {
      return { id: s, label: s.replace('x', ' × ') };
    }), state.exportSize, function (id) {
      pushHistory();
      state.exportSize = id;
      syncControls();
      render();
    });
    el('title-input').value = state.title;
    el('subtitle-input').value = state.subtitle;
    el('badge-input').value = state.badge;
    el('grain-check').checked = state.grain;
    el('vignette-check').checked = state.vignette;
    buildStars();
    buildTray();
    syncUndoButtons();
  }

  function syncUndoButtons() {
    el('undo-btn').disabled = undoStack.length === 0;
    el('redo-btn').disabled = redoStack.length === 0;
  }

  // ---------------------------------------------------------------- canvas input

  function panelAt(clientX, clientY) {
    var rect = stage.getBoundingClientRect();
    var ux = (clientX - rect.left) / rect.width;
    var uy = (clientY - rect.top) / rect.height;
    var panels = window.CoverArt.LAYOUTS[state.layout].panels();
    for (var i = panels.length - 1; i >= 0; i--) {
      var p = panels[i];
      if (p.poly) {
        if (pointInPoly(ux, uy, p.poly)) return i;
      } else if (ux >= p.x && ux <= p.x + p.w && uy >= p.y && uy <= p.y + p.h) {
        return i;
      }
    }
    return -1;
  }

  function pointInPoly(x, y, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  function bindCanvas() {
    stage.addEventListener('pointerdown', function (ev) {
      var slot = panelAt(ev.clientX, ev.clientY);
      if (slot < 0) return;
      selected = slot;
      pushHistory();
      var rect = stage.getBoundingClientRect();
      drag = {
        slot: slot,
        startX: ev.clientX,
        startY: ev.clientY,
        baseX: state.panels[slot].x,
        baseY: state.panels[slot].y,
        rectW: rect.width,
        rectH: rect.height,
      };
      stage.setPointerCapture(ev.pointerId);
      render();
    });
    stage.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      var panels = window.CoverArt.LAYOUTS[state.layout].panels();
      var p = panels[drag.slot];
      var place = state.panels[drag.slot];
      place.x = drag.baseX + (ev.clientX - drag.startX) / drag.rectW / Math.max(0.05, p.w);
      place.y = drag.baseY + (ev.clientY - drag.startY) / drag.rectH / Math.max(0.05, p.h);
      render();
    });
    stage.addEventListener('pointerup', function () { drag = null; });
    stage.addEventListener('pointercancel', function () { drag = null; });
    stage.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var slot = panelAt(ev.clientX, ev.clientY);
      if (slot < 0) return;
      if (!drag) pushHistory();
      var place = state.panels[slot];
      place.zoom = Math.max(1, Math.min(4, place.zoom * (ev.deltaY < 0 ? 1.12 : 0.89)));
      render();
    }, { passive: false });
  }

  function bindUpload() {
    var input = el('upload-input');
    el('upload-btn').addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      var files = Array.prototype.slice.call(input.files || []);
      if (!files.length) return;
      var pending = files.map(function (file) {
        return new Promise(function (resolve) {
          var reader = new FileReader();
          reader.onload = function () {
            resolve({ id: 'up-' + Date.now() + '-' + Math.floor(Math.random() * 1e6), name: file.name.replace(/\.[^.]+$/, ''), src: reader.result });
          };
          reader.readAsDataURL(file);
        });
      });
      Promise.all(pending).then(function (entries) {
        pushHistory();
        entries.forEach(function (entry) {
          state.photos.push(entry);
          state.panels[selected].photo = state.photos.length - 1;
        });
        loadAllPhotos().then(function () { buildTray(); render(); });
      });
      input.value = '';
    });
    el('fill-all-btn').addEventListener('click', function () {
      pushHistory();
      var photo = state.panels[selected].photo;
      state.panels.forEach(function (place) { place.photo = photo; });
      render();
    });
  }

  // ---------------------------------------------------------------- shot mode

  // ?shot=cover|editor&photo=pier&photo2=boulevard&layout=nine&grade=neon
  // &caption=Neon%20Shore&sub=Night%20Drive&size=1920x1080
  function applyParams() {
    var q = new URLSearchParams(window.location.search);
    var shot = q.get('shot') || 'editor';
    var layout = q.get('layout');
    var grade = q.get('grade');
    if (layout && window.CoverArt.LAYOUTS[layout]) state.layout = layout;
    if (grade && window.CoverArt.GRADES[grade]) state.grade = grade;
    if (q.get('caption') !== null) state.title = q.get('caption');
    if (q.get('sub') !== null) state.subtitle = q.get('sub');
    if (q.get('size') && EXPORT_SIZES.indexOf(q.get('size')) >= 0) state.exportSize = q.get('size');
    var first = q.get('photo');
    var second = q.get('photo2');
    var firstIdx = SAMPLES.findIndex(function (s) { return s.id === first; });
    var secondIdx = SAMPLES.findIndex(function (s) { return s.id === second; });
    if (firstIdx >= 0) {
      state.panels.forEach(function (place, i) {
        place.photo = (secondIdx >= 0 && i % 2 === 1) ? secondIdx : firstIdx;
      });
    }
    if (shot === 'cover') {
      document.body.classList.add('shot-cover');
      var size = sizeOf(state.exportSize);
      stage.width = size.w;
      stage.height = size.h;
      stage.style.width = '100vw';
      stage.style.height = '100vh';
    }
    return shot;
  }

  // ---------------------------------------------------------------- boot

  function boot() {
    stage = el('stage');
    var shot = applyParams();
    syncControls();
    bindCanvas();
    bindUpload();
    el('undo-btn').addEventListener('click', undo);
    el('redo-btn').addEventListener('click', redo);
    el('export-btn').addEventListener('click', function () { downloadPNG(state.exportSize); });
    el('export-all-btn').addEventListener('click', exportAll);
    el('title-input').addEventListener('input', function (ev) { state.title = ev.target.value; render(); });
    el('title-input').addEventListener('change', function () { pushHistory(); });
    el('subtitle-input').addEventListener('input', function (ev) { state.subtitle = ev.target.value; render(); });
    el('subtitle-input').addEventListener('change', function () { pushHistory(); });
    el('badge-input').addEventListener('input', function (ev) { state.badge = ev.target.value; render(); });
    el('badge-input').addEventListener('change', function () { pushHistory(); });
    el('grain-check').addEventListener('change', function (ev) { pushHistory(); state.grain = ev.target.checked; render(); });
    el('vignette-check').addEventListener('change', function (ev) { pushHistory(); state.vignette = ev.target.checked; render(); });

    window.__coverStudio = {
      ready: false,
      state: state,
      render: render,
      exportDataURL: exportDataURL,
    };

    var fontsReady = (document.fonts ? document.fonts.ready : Promise.resolve());
    Promise.all([loadAllPhotos(), fontsReady]).then(function () {
      render();
      window.__coverStudio.ready = true;
      document.title = 'ready';
    }).catch(function (err) {
      window.__coverStudio.error = String(err);
      document.title = 'error';
    });
    if (shot === 'cover') render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
