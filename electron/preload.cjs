// Preload — bridges page <-> main and injects the debug overlay.

const { ipcRenderer, contextBridge } = require('electron');

const TEXT_INPUT_TYPES = new Set([
  'text', 'tel', 'email', 'password', 'search',
  'url', 'number', 'date', 'datetime-local', 'month', 'time', 'week',
]);

function describeEl(el) {
  if (!el) return null;
  return {
    tag: el.tagName,
    type: el.getAttribute ? el.getAttribute('type') : null,
    id: el.id || null,
    name: el.name || null,
    placeholder: el.placeholder || null,
    editable: !!(el.isContentEditable),
  };
}

function isTextEditable(el) {
  if (!el || !(el instanceof Element)) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    return TEXT_INPUT_TYPES.has(type);
  }
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  return false;
}

window.addEventListener('focusin', (e) => {
  const info = describeEl(e.target);
  if (isTextEditable(e.target)) {
    ipcRenderer.send('input-focus', info);
  } else {
    // Still log non-input focus for debugging
    ipcRenderer.send('debug-non-input-focus', info);
  }
}, true);

window.addEventListener('focusout', (e) => {
  if (isTextEditable(e.target)) {
    ipcRenderer.send('input-blur', describeEl(e.target));
  }
}, true);

window.addEventListener('pagehide', () => ipcRenderer.send('input-blur'));
window.addEventListener('beforeunload', () => ipcRenderer.send('input-blur'));

// ============================================================
// Inject debug overlay into the page
// ============================================================
function injectOverlay() {
  if (document.getElementById('__kiosk_debug_overlay')) return;

  const css = `
    #__kiosk_debug_overlay {
      position: fixed; top: 8px; left: 8px; z-index: 2147483647;
      width: 380px; max-height: 60vh; display: flex; flex-direction: column;
      background: rgba(0,0,0,0.88); color: #0f0; font: 12px/1.4 ui-monospace, Menlo, Consolas, monospace;
      border: 1px solid #0f0; border-radius: 6px; padding: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6); direction: ltr; text-align: left;
    }
    #__kiosk_debug_overlay.hidden { display: none; }
    #__kiosk_debug_overlay .hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    #__kiosk_debug_overlay .hdr b { color: #fff; }
    #__kiosk_debug_overlay .btns { display: flex; gap: 4px; margin-bottom: 6px; flex-wrap: wrap; }
    #__kiosk_debug_overlay button {
      background: #111; color: #0f0; border: 1px solid #0f0; border-radius: 3px;
      padding: 3px 6px; font: inherit; cursor: pointer;
    }
    #__kiosk_debug_overlay button:hover { background: #0f0; color: #000; }
    #__kiosk_debug_overlay .log { flex: 1; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
    #__kiosk_debug_overlay .log .ERROR { color: #f55; }
    #__kiosk_debug_overlay .log .WARN  { color: #fa0; }
    #__kiosk_debug_overlay .log .OK    { color: #5f5; }
    #__kiosk_debug_overlay .log .ACTION{ color: #ff0; }
    #__kiosk_debug_overlay .log .EVENT { color: #0ff; }
    #__kiosk_debug_overlay .log .TEST  { color: #f0f; }
    #__kiosk_debug_overlay .log .INFO  { color: #aaa; }
    #__kiosk_debug_overlay .log .DEBUG { color: #777; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = '__kiosk_debug_overlay';
  el.innerHTML = `
    <div class="hdr">
      <b>🛠 Kiosk Debug</b>
      <button data-act="hide" title="Hide (Ctrl+Shift+D)">×</button>
    </div>
    <div class="btns">
      <button data-act="test-open">Test Open TabTip</button>
      <button data-act="test-kill">Kill TabTip</button>
      <button data-act="rerun">Re-run diagnostics</button>
      <button data-act="clear">Clear log</button>
    </div>
    <div class="log" id="__kiosk_debug_log"></div>
  `;
  document.body.appendChild(el);

  el.addEventListener('click', (e) => {
    const act = e.target.getAttribute && e.target.getAttribute('data-act');
    if (!act) return;
    if (act === 'hide') el.classList.add('hidden');
    if (act === 'test-open') ipcRenderer.send('debug-test-tabtip');
    if (act === 'test-kill') ipcRenderer.send('debug-kill-tabtip');
    if (act === 'rerun') ipcRenderer.send('debug-rerun-diagnostics');
    if (act === 'clear') document.getElementById('__kiosk_debug_log').innerHTML = '';
  });
}

function appendLog({ level, msg, ts }) {
  const log = document.getElementById('__kiosk_debug_log');
  if (!log) return;
  const line = document.createElement('div');
  line.className = level || 'INFO';
  line.textContent = `[${ts}] ${level} ${msg}`;
  log.appendChild(line);
  // Cap at 500 lines
  while (log.childNodes.length > 500) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
}

ipcRenderer.on('debug-log', (_e, payload) => appendLog(payload));
ipcRenderer.on('debug-toggle', () => {
  const el = document.getElementById('__kiosk_debug_overlay');
  if (el) el.classList.toggle('hidden');
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectOverlay);
} else {
  injectOverlay();
}
