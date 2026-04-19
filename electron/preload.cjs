// Preload — runs in the page context with access to ipcRenderer.
// Detects focus/blur on text inputs and notifies main to toggle TabTip.

const { ipcRenderer } = require('electron');

const TEXT_INPUT_TYPES = new Set([
  'text', 'tel', 'email', 'password', 'search',
  'url', 'number', 'date', 'datetime-local', 'month', 'time', 'week',
]);

function isTextEditable(el) {
  if (!el || !(el instanceof Element)) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    return TEXT_INPUT_TYPES.has(type);
  }
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  return false;
}

window.addEventListener(
  'focusin',
  (e) => {
    if (isTextEditable(e.target)) {
      ipcRenderer.send('input-focus');
    }
  },
  true,
);

window.addEventListener(
  'focusout',
  (e) => {
    if (isTextEditable(e.target)) {
      ipcRenderer.send('input-blur');
    }
  },
  true,
);

// Safety: when the page is hidden / unloaded, close the keyboard
window.addEventListener('pagehide', () => ipcRenderer.send('input-blur'));
window.addEventListener('beforeunload', () => ipcRenderer.send('input-blur'));
