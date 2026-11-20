// Neon Coast Cover Studio — editor (round 5 build).
// State, history, controls, photo handling, export and screenshot presets.
// Uses the rendering engine in src/cover.js (window.NeonCoast).
(function () {
  'use strict';
  var NC = window.NeonCoast;

  var SAMPLE_PHOTOS = [
    { id: 'pier', src: 'samples/pier.jpg', name: 'Pier' },
    { id: 'blvd', src: 'samples/boulevard.jpg', name: 'Boulevard' },
  ];

  // Nine slots (the biggest layout), alternating the two samples.
  function freshAssign() {
    var out = [];
    for (var i = 0; i < 9; i++) {
      out.push({ photo: i % 2 === 0 ? 'blvd' : 'pier', dx: 0, dy: 0, zoom: 1 });
    }
    return out;
  }

  function freshState() {
    return {
      layout: 'hero',
      grade: 'golden',
      grain: true,
      vignette: true,
      title: 'BOULEVARD QUEEN',
      subtitle: 'Night Drive',
      stars: 4,
      ribbon: true,
      size: '1080x1080',
      photos: SAMPLE_PHOTOS.slice(),
      assign: freshAssign(),
      selected: 0,
    };
  }

  var state = freshState();
  var images = new Map(); // photo id -> HTMLImageElement
  var undoStack = [];
  var redoStack = [];
  var uploadCount = 0;
  var wheelSnap = null;
  var wheelTimer = null;

  // Grab every control once, up front.
  var stage = document.getElementById('coverStage');
  var layoutRow = document.getElementById('layoutRow');
  var gradeRow = document.getElementById('gradeRow');
  var sizeRow = document.getElementById('sizeRow');
  var thumbRow = document.getElementById('thumbRow');
  var undoBtn = document.getElementById('undoBtn');
  var redoBtn = document.getElementById('redoBtn');
  var grainChk = document.getElementById('grainChk');
  var vignetteChk = document.getElementById('vignetteChk');
  var ribbonChk = document.getElementById('ribbonChk');
  var titleInput = document.getElementById('titleInput');
  var subtitleInput = document.getElementById('subtitleInput');
  var starsInput = document.getElementById('starsInput');
  var starsLabel = document.getElementById('starsLabel');
  var fileInput = document.getElementById('fileInput');
  var exportBtn = document.getElementById('exportBtn');
  var exportAllBtn = document.getElementById('exportAllBtn');
  var exportNote = document.getElementById('exportNote');

  function loadImage(photo) {
    if (images.has(photo.id)) return Promise.resolve(images.get(photo.id));
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        images.set(photo.id, img);
        resolve(img);
      };
      img.onerror = function () { reject(new Error('could not load ' + photo.src)); };
      img.src = photo.src;
    });
  }

  function snapshot() { return JSON.stringify(state); }

  function pushHistory() {
    undoStack.push(snapshot());
    if (undoStack.length > 60) undoStack.shift();
    redoStack.length = 0;
    syncUndoButtons();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    state = JSON.parse(undoStack.pop());
    render();
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    state = JSON.parse(redoStack.pop());
    render();
  }

  function syncUndoButtons() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
  }

  // The drag/zoom slot for a panel: its pixel size plus the offset of the
  // photo inside a polaroid frame. Duo panels span the whole cover.
  function slotSizeFor(idx, coverW, coverH) {
    var rects = NC.layoutRects(state.layout, coverW, coverH);
    var rect = rects[idx];
    if (!rect) return { w: coverW, h: coverH, ox: 0, oy: 0 };
    if (rect.frame) {
      var inner = NC.tiltInner(rect);
      return { w: inner.w, h: inner.h, ox: inner.x, oy: inner.y };
    }
    if (rect.poly) return { w: coverW, h: coverH, ox: 0, oy: 0 };
    return { w: rect.w, h: rect.h, ox: 0, oy: 0 };
  }

  // Selecting a different panel is cheap: just move the highlight, no
  // full re-render.
  function renderSelectionOnly() {
    var slots = stage.querySelectorAll('.slot');
    for (var i = 0; i < slots.length; i++) {
      slots[i].classList.toggle('selected', Number(slots[i].dataset.slot) === state.selected);
    }
    var thumbs = thumbRow.querySelectorAll('img');
    for (var j = 0; j < thumbs.length; j++) {
      thumbs[j].classList.toggle('active', thumbs[j].dataset.photo === state.assign[state.selected].photo);
    }
  }

  function renderThumbs() {
    thumbRow.innerHTML = '';
    state.photos.forEach(function (photo) {
      var img = document.createElement('img');
      img.src = photo.src;
      img.alt = photo.name;
      img.title = photo.name;
      img.dataset.photo = photo.id;
      if (state.assign[state.selected].photo === photo.id) img.classList.add('active');
      img.addEventListener('click', function () {
        if (state.assign[state.selected].photo === photo.id) return;
        pushHistory();
        state.assign[state.selected].photo = photo.id;
        render();
      });
      thumbRow.appendChild(img);
    });
  }

  function markActive(row, attr, value) {
    var btns = row.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].dataset[attr] === value);
    }
  }

  function render() {
    var size = NC.sizeById(state.size);
    stage.style.aspectRatio = size.w + ' / ' + size.h;
    NC.buildCover(state, images, stage, state.selected);
    markActive(layoutRow, 'layout', state.layout);
    markActive(gradeRow, 'grade', state.grade);
    markActive(sizeRow, 'size', state.size);
    // Don't clobber the field the user is typing in.
    if (document.activeElement !== titleInput) titleInput.value = state.title;
    if (document.activeElement !== subtitleInput) subtitleInput.value = state.subtitle;
    if (document.activeElement !== starsInput) starsInput.value = String(state.stars);
    grainChk.checked = state.grain;
    vignetteChk.checked = state.vignette;
    ribbonChk.checked = state.ribbon;
    starsLabel.textContent = NC.starString(state.stars);
    renderThumbs();
    syncUndoButtons();
  }

  function buildControls() {
    NC.LAYOUTS.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = l.name;
      b.dataset.layout = l.id;
      b.addEventListener('click', function () {
        if (state.layout === l.id) return;
        pushHistory();
        state.layout = l.id;
        state.selected = 0;
        render();
      });
      layoutRow.appendChild(b);
    });
    NC.GRADES.forEach(function (g) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.dataset.grade = g.id;
      b.title = g.name;
      b.setAttribute('aria-label', g.name);
      b.style.background = 'linear-gradient(135deg, ' + g.tint + ', #2a1650)';
      b.addEventListener('click', function () {
        if (state.grade === g.id) return;
        pushHistory();
        state.grade = g.id;
        render();
      });
      gradeRow.appendChild(b);
    });
    NC.SIZES.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = s.label;
      b.dataset.size = s.id;
      b.addEventListener('click', function () {
        if (state.size === s.id) return;
        pushHistory();
        state.size = s.id;
        render();
      });
      sizeRow.appendChild(b);
    });
  }

  // Text fields: live preview while typing, one history entry per edit
  // (snapshot on focus, committed on change).
  function bindText(input, key) {
    var snap = null;
    input.addEventListener('focus', function () { snap = snapshot(); });
    input.addEventListener('input', function () {
      state[key] = input.value;
      render();
    });
    input.addEventListener('change', function () {
      if (snap !== null && snap !== snapshot()) {
        undoStack.push(snap);
        if (undoStack.length > 60) undoStack.shift();
        redoStack.length = 0;
        syncUndoButtons();
      }
      snap = null;
    });
  }

  function bindChecks() {
    grainChk.addEventListener('change', function () {
      pushHistory();
      state.grain = grainChk.checked;
      render();
    });
    vignetteChk.addEventListener('change', function () {
      pushHistory();
      state.vignette = vignetteChk.checked;
      render();
    });
    ribbonChk.addEventListener('change', function () {
      pushHistory();
      state.ribbon = ribbonChk.checked;
      render();
    });
    starsInput.addEventListener('input', function () {
      state.stars = Number(starsInput.value);
      render();
    });
    starsInput.addEventListener('change', function () {
      pushHistory();
      render();
    });
  }

  function bindPhotos() {
    document.getElementById('samplePier').addEventListener('click', function () {
      if (state.assign[state.selected].photo === 'pier') return;
      pushHistory();
      state.assign[state.selected].photo = 'pier';
      render();
    });
    document.getElementById('sampleBlvd').addEventListener('click', function () {
      if (state.assign[state.selected].photo === 'blvd') return;
      pushHistory();
      state.assign[state.selected].photo = 'blvd';
      render();
    });
    fileInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(fileInput.files || []);
      if (!files.length) return;
      pushHistory();
      var jobs = files.map(function (file) {
        return new Promise(function (resolve) {
          var reader = new FileReader();
          reader.onload = function () {
            var photo = { id: 'up' + (++uploadCount), src: String(reader.result), name: file.name };
            state.photos.push(photo);
            loadImage(photo).then(resolve, resolve);
          };
          reader.onerror = resolve;
          reader.readAsDataURL(file);
        });
      });
      Promise.all(jobs).then(function () {
        var last = state.photos[state.photos.length - 1];
        state.assign[state.selected].photo = last.id;
        render();
      });
      fileInput.value = '';
    });
  }

  function bindPanels() {
    stage.addEventListener('pointerdown', function (e) {
      var slotEl = e.target.closest('.slot');
      if (!slotEl) return;
      var idx = Number(slotEl.dataset.slot);
      var before = snapshot();
      state.selected = idx;
      renderSelectionOnly();
      var imgEl = slotEl.querySelector('img');
      var img = images.get(state.assign[idx].photo);
      if (!img || !imgEl) return;
      var coverW = stage.clientWidth;
      var coverH = stage.clientHeight;
      var slot = slotSizeFor(idx, coverW, coverH);
      var startX = e.clientX;
      var startY = e.clientY;
      var startCrop = { dx: state.assign[idx].dx, dy: state.assign[idx].dy, zoom: state.assign[idx].zoom };
      var moved = false;
      function onMove(ev) {
        var crop = state.assign[idx];
        crop.dx = startCrop.dx + (ev.clientX - startX) / slot.w;
        crop.dy = startCrop.dy + (ev.clientY - startY) / slot.h;
        NC.clampCrop(slot, img, crop);
        NC.positionSlotImg(imgEl, slot, img, crop, slot.ox, slot.oy);
        moved = true;
      }
      function onUp() {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (moved) {
          undoStack.push(before);
          if (undoStack.length > 60) undoStack.shift();
          redoStack.length = 0;
          syncUndoButtons();
        }
        render();
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      e.preventDefault();
    });

    stage.addEventListener('wheel', function (e) {
      var slotEl = e.target.closest('.slot');
      if (!slotEl) return;
      e.preventDefault();
      var idx = Number(slotEl.dataset.slot);
      var img = images.get(state.assign[idx].photo);
      if (!img) return;
      if (wheelSnap === null) wheelSnap = snapshot();
      var slot = slotSizeFor(idx, stage.clientWidth, stage.clientHeight);
      var crop = state.assign[idx];
      crop.zoom = Math.max(1, Math.min(3, crop.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
      NC.clampCrop(slot, img, crop);
      var imgEl = slotEl.querySelector('img');
      if (imgEl) NC.positionSlotImg(imgEl, slot, img, crop, slot.ox, slot.oy);
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(function () {
        if (wheelSnap !== null) {
          undoStack.push(wheelSnap);
          if (undoStack.length > 60) undoStack.shift();
          redoStack.length = 0;
          syncUndoButtons();
          wheelSnap = null;
        }
        render();
      }, 350);
    }, { passive: false });
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function bindExport() {
    exportBtn.addEventListener('click', function () {
      var size = NC.sizeById(state.size);
      exportNote.textContent = 'Rendering ' + size.label + '…';
      NC.exportPNG(state, images, size.w, size.h).then(function (blob) {
        downloadBlob(blob, 'neon-coast-' + size.id + '.png');
        exportNote.textContent = 'Exported neon-coast-' + size.id + '.png (' + blob.size + ' bytes).';
      }).catch(function (err) {
        exportNote.textContent = 'Export failed: ' + err.message;
      });
    });
    exportAllBtn.addEventListener('click', function () {
      exportNote.textContent = 'Rendering all four sizes…';
      var chain = Promise.resolve();
      NC.SIZES.forEach(function (size) {
        chain = chain.then(function () {
          return NC.exportPNG(state, images, size.w, size.h).then(function (blob) {
            downloadBlob(blob, 'neon-coast-' + size.id + '.png');
          });
        });
      });
      chain.then(function () {
        exportNote.textContent = 'Exported all four sizes.';
      }).catch(function (err) {
        exportNote.textContent = 'Export failed: ' + err.message;
      });
    });
  }

  // Screenshot presets (?shot=...). Cover shots render the export canvas
  // full-window; the editor shot shows the normal editor.
  var PRESETS = {
    editor: { layout: 'hero', grade: 'golden', title: 'BOULEVARD QUEEN', subtitle: 'Night Drive', stars: 4, ribbon: true, size: '1080x1080' },
    cover: { layout: 'nine', grade: 'neon', title: 'NEON SHORE', subtitle: 'Night Drive', stars: 4, ribbon: true, size: '1920x1080' },
    square: { layout: 'four', grade: 'vice', title: 'PIER PRESSURE', subtitle: 'Night Drive', stars: 4, ribbon: true, size: '1080x1080' },
    portrait: { layout: 'hero', grade: 'golden', title: 'GOLDEN HOUR', subtitle: 'Night Drive', stars: 4, ribbon: true, size: '1080x1350' },
  };
  var SHOT_DIMS = {
    cover: [1280, 720],
    square: [1080, 1080],
    portrait: [1024, 1280],
  };
  var params = new URLSearchParams(location.search);
  var shot = params.get('shot');

  function applyPreset() {
    if (!shot || !PRESETS[shot]) return;
    var p = PRESETS[shot];
    Object.keys(p).forEach(function (k) { state[k] = p[k]; });
    if (shot !== 'editor') document.body.classList.add('shot');
  }

  function renderShotCanvas() {
    var dims = SHOT_DIMS[shot];
    if (!dims) return Promise.resolve();
    // renderToCanvas is synchronous (it returns the canvas), so call it
    // directly — awaiting it as a promise would throw and never set
    // __shotReady.
    var canvas = NC.renderToCanvas(state, images, dims[0], dims[1]);
    stage.innerHTML = '';
    stage.style.aspectRatio = dims[0] + ' / ' + dims[1];
    canvas.className = 'shot-canvas';
    stage.appendChild(canvas);
    return Promise.resolve();
  }

  function init() {
    buildControls();
    bindText(titleInput, 'title');
    bindText(subtitleInput, 'subtitle');
    bindChecks();
    bindPhotos();
    bindPanels();
    bindExport();
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    });
    applyPreset();
    Promise.all(state.photos.map(loadImage)).then(function () {
      return Promise.all([
        document.fonts.load('80px Anton'),
        document.fonts.load('40px Pacifico'),
        document.fonts.ready,
      ]).catch(function () { /* fall back to system fonts */ });
    }).then(function () {
      render();
      if (shot && shot !== 'editor') return renderShotCanvas();
      return null;
    }).then(function () {
      window.__shotReady = true;
    }).catch(function (err) {
      window.__shotError = String(err && err.message || err);
    });
  }

  // Test hooks for the screenshot driver and the local checks.
  window.__cover = {
    state: function () { return state; },
    exportPNG: function (w, h) { return NC.exportPNG(state, images, w, h); },
    renderToCanvas: function (w, h) { return NC.renderToCanvas(state, images, w, h); },
  };

  init();
})();
