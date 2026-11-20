// Neon Coast Cover Studio — app wiring.
// Loads the local fonts, reads URL params (including shot mode for
// screenshots), wires every control, and re-renders the cover on change.

import { drawCover } from './cover.js';

const SIZES = {
  square: { label: 'Square', width: 1080, height: 1080 },
  portrait: { label: 'Portrait', width: 1080, height: 1350 },
  wide: { label: 'Wide', width: 1920, height: 1080 },
};

const SAMPLES = {
  pier: 'samples/pier.jpg',
  boulevard: 'samples/boulevard.jpg',
};

const state = {
  photo: SAMPLES.pier,
  title: 'SUNSET HEIST',
  accent: 'Vice City nights',
  size: 'wide',
};

const imageCache = new Map();
let currentImage = null;
let renderToken = 0;

const $ = (id) => document.getElementById(id);

function params() {
  return new URLSearchParams(window.location.search);
}

/** Load one photo by src (cached) and resolve with its Image, or null on error. */
function loadPhoto(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const job = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  imageCache.set(src, job);
  return job;
}

function showError(message) {
  const box = $('error');
  if (!box) return;
  box.textContent = message;
  box.hidden = !message;
}

function render() {
  const token = ++renderToken;
  const canvas = $('cover');
  const size = SIZES[state.size] || SIZES.wide;
  const photo = state.photo;
  loadPhoto(photo).then((img) => {
    if (token !== renderToken) return; // a newer render already started
    if (!img) {
      showError(`Could not load that photo (${photo}). Try a sample or another file.`);
      // Still paint the grade + text so the canvas is never blank.
      drawCover(canvas, { image: null, title: state.title, accent: state.accent, width: size.width, height: size.height });
    } else {
      showError('');
      currentImage = img;
      drawCover(canvas, { image: img, title: state.title, accent: state.accent, width: size.width, height: size.height });
    }
    // Signal for the screenshot script: the first render is done.
    window.__coverReady = true;
  });
}

function setPhoto(src, label) {
  state.photo = src;
  window.__coverReady = false;
  document.querySelectorAll('[data-sample]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.sample === label);
  });
  render();
}

function applyParams() {
  const q = params();
  const shot = q.get('shot');
  if (shot === 'cover' || shot === 'editor') {
    document.body.classList.add('shot-mode');
    if (shot === 'cover') document.body.classList.add('shot-cover');
  }
  const photo = q.get('photo');
  if (photo && SAMPLES[photo]) state.photo = SAMPLES[photo];
  const caption = q.get('caption');
  if (caption) state.title = caption;
  const accent = q.get('accent');
  if (accent) state.accent = accent;
  const size = q.get('size');
  if (size && SIZES[size]) state.size = size;
}

function syncControls() {
  const titleInput = $('title');
  if (titleInput) titleInput.value = state.title;
  const accentInput = $('accent');
  if (accentInput) accentInput.value = state.accent;
  document.querySelectorAll('input[name="size"]').forEach((radio) => {
    radio.checked = radio.value === state.size;
  });
  const key = Object.keys(SAMPLES).find((k) => SAMPLES[k] === state.photo);
  document.querySelectorAll('[data-sample]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.sample === key);
  });
}

async function loadFonts() {
  try {
    const anton = new FontFace('Anton', 'url(../fonts/Anton-Regular.ttf)', { weight: '400' });
    const pacifico = new FontFace('Pacifico', 'url(../fonts/Pacifico-Regular.ttf)', { weight: '400' });
    const loaded = await Promise.all([anton.load(), pacifico.load()]);
    loaded.forEach((face) => document.fonts.add(face));
    await document.fonts.ready;
  } catch (err) {
    // Fonts are a nicety, not a blocker: the canvas falls back to system fonts.
    console.warn('Local fonts did not load, using fallbacks:', err);
  }
}

function wireControls() {
  document.querySelectorAll('[data-sample]').forEach((btn) => {
    btn.addEventListener('click', () => setPhoto(SAMPLES[btn.dataset.sample], btn.dataset.sample));
  });

  const fileInput = $('photo-file');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showError('That file is not an image. Pick a JPG or PNG photo.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setPhoto(String(reader.result), '');
      reader.onerror = () => showError('Could not read that file. Try another photo.');
      reader.readAsDataURL(file);
      // Clear the input so choosing the same file again still fires a change.
      fileInput.value = '';
    });
  }

  const titleInput = $('title');
  if (titleInput) {
    titleInput.addEventListener('input', () => {
      state.title = titleInput.value;
      render();
    });
  }
  const accentInput = $('accent');
  if (accentInput) {
    accentInput.addEventListener('input', () => {
      state.accent = accentInput.value;
      render();
    });
  }

  document.querySelectorAll('input[name="size"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        state.size = radio.value;
        render();
      }
    });
  });

  const exportBtn = $('export');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const canvas = $('cover');
      const size = SIZES[state.size] || SIZES.wide;
      canvas.toBlob((blob) => {
        if (!blob) {
          showError('Export failed — the browser could not make a PNG. Try again.');
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `neon-coast-cover-${state.size}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }, 'image/png');
    });
  }
}

async function main() {
  applyParams();
  syncControls();
  wireControls();
  await loadFonts();
  render();
}

main().catch((err) => {
  console.error(err);
  showError('Something went wrong starting the studio. Reload the page to try again.');
});
