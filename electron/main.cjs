// Electron main process — Kiosk wrapper for הבקתה
// DEBUG BUILD — full diagnostics for TabTip integration
//
// Logs go to:
//   • stdout (visible if launched from cmd)
//   • %APPDATA%\hakata-kiosk\kiosk-debug.log
//   • In-app debug overlay (toggle with Ctrl+Shift+D)

const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec, execSync } = require('child_process');

// ============================================================
// Config
// ============================================================
const KIOSK_URL = process.env.KIOSK_URL || 'https://yum-order-maker.lovable.app/kiosk';
const TABTIP_PATH = 'C:\\Program Files\\Common Files\\microsoft shared\\ink\\TabTip.exe';

// ============================================================
// Logging — to file + stdout + send to renderer overlay
// ============================================================
const LOG_DIR = app.getPath('userData');
const LOG_FILE = path.join(LOG_DIR, 'kiosk-debug.log');

try {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  // Truncate on each launch
  fs.writeFileSync(LOG_FILE, `=== Kiosk debug log — ${new Date().toISOString()} ===\n`);
} catch (e) {
  console.error('Could not init log file:', e);
}

let mainWindow = null;

function log(level, ...args) {
  const ts = new Date().toISOString().split('T')[1].replace('Z', '');
  const msg = args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ');
  const line = `[${ts}] [${level}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch {}
  // Forward to overlay
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('debug-log', { level, msg, ts });
  }
}

// ============================================================
// Diagnostics — run once on startup
// ============================================================
function runDiagnostics() {
  log('INFO', '═══════════════ DIAGNOSTICS ═══════════════');
  log('INFO', `Platform: ${process.platform} ${process.arch}`);
  log('INFO', `Electron: ${process.versions.electron}, Node: ${process.versions.node}`);
  log('INFO', `Log file: ${LOG_FILE}`);
  log('INFO', `Kiosk URL: ${KIOSK_URL}`);

  if (process.platform !== 'win32') {
    log('WARN', `⚠ Not running on Windows (${process.platform}) — TabTip will not work.`);
    return;
  }

  // 1. Does TabTip.exe exist?
  if (fs.existsSync(TABTIP_PATH)) {
    log('OK', `✓ TabTip.exe found at: ${TABTIP_PATH}`);
  } else {
    log('ERROR', `✗ TabTip.exe NOT FOUND at: ${TABTIP_PATH}`);
    log('ERROR', '  Touch keyboard feature may not be installed on this Windows.');
  }

  // 2. Is the Touch Keyboard service running?
  try {
    const svc = execSync('sc query TabletInputService', { encoding: 'utf8', timeout: 5000 });
    log('INFO', 'TabletInputService status:');
    svc.split('\n').forEach((l) => { if (l.trim()) log('INFO', '  ' + l.trim()); });
    if (svc.includes('RUNNING')) {
      log('OK', '✓ TabletInputService is RUNNING');
    } else {
      log('ERROR', '✗ TabletInputService is NOT running. Start it from services.msc');
    }
  } catch (e) {
    log('ERROR', `✗ Could not query TabletInputService: ${e.message}`);
  }

  // 3. Touch keyboard registry setting (Windows 10/11)
  try {
    const reg = execSync(
      'reg query "HKCU\\Software\\Microsoft\\TabletTip\\1.7" /v EnableDesktopModeAutoInvoke',
      { encoding: 'utf8', timeout: 5000 },
    );
    log('INFO', 'Auto-invoke registry:');
    reg.split('\n').forEach((l) => { if (l.trim()) log('INFO', '  ' + l.trim()); });
  } catch {
    log('WARN', '⚠ Auto-invoke registry key not set (this is OK — we trigger TabTip manually)');
  }

  log('INFO', '═══════════════════════════════════════════');
}

// ============================================================
// TabTip controller
// ============================================================
let tabTipOpen = false;
let pendingAction = null;
let lastOpenAttempt = 0;

function openTabTip() {
  if (tabTipOpen) {
    log('DEBUG', 'openTabTip: already open, skipping');
    return;
  }
  if (!fs.existsSync(TABTIP_PATH)) {
    log('ERROR', `openTabTip: TabTip.exe missing at ${TABTIP_PATH}`);
    return;
  }
  tabTipOpen = true;
  lastOpenAttempt = Date.now();
  log('ACTION', `→ Spawning TabTip.exe`);
  try {
    const child = spawn(TABTIP_PATH, [], { detached: true, stdio: 'ignore' });
    child.on('error', (err) => {
      log('ERROR', `TabTip spawn error: ${err.message}`);
      tabTipOpen = false;
    });
    child.on('exit', (code) => {
      log('DEBUG', `TabTip child process exited code=${code}`);
    });
    child.unref();
    log('OK', `✓ TabTip spawn dispatched (pid=${child.pid})`);
  } catch (err) {
    log('ERROR', `openTabTip threw: ${err.message}`);
    tabTipOpen = false;
  }
}

function closeTabTip() {
  if (!tabTipOpen) {
    log('DEBUG', 'closeTabTip: not open, skipping');
    return;
  }
  // Don't close immediately after opening — user just focused
  if (Date.now() - lastOpenAttempt < 250) {
    log('DEBUG', 'closeTabTip: too soon after open, skipping');
    return;
  }
  tabTipOpen = false;
  log('ACTION', `→ Killing TabTip.exe`);
  exec('taskkill /IM TabTip.exe /F', (err, stdout, stderr) => {
    if (err) {
      log('WARN', `taskkill warning: ${err.message.trim()}`);
    } else {
      log('OK', `✓ TabTip killed: ${stdout.trim()}`);
    }
  });
}

function scheduleAction(action, info) {
  log('EVENT', `${action.toUpperCase()} from ${info?.tag || '?'}${info?.type ? '['+info.type+']' : ''}${info?.id ? '#'+info.id : ''}`);
  if (pendingAction) clearTimeout(pendingAction);
  pendingAction = setTimeout(() => {
    pendingAction = null;
    if (action === 'open') openTabTip();
    else closeTabTip();
  }, 120);
}

ipcMain.on('input-focus', (_e, info) => scheduleAction('open', info));
ipcMain.on('input-blur', (_e, info) => scheduleAction('close', info));

// Manual test button from overlay
ipcMain.on('debug-test-tabtip', () => {
  log('TEST', '═══ Manual TabTip test triggered ═══');
  tabTipOpen = false; // force re-open
  openTabTip();
});
ipcMain.on('debug-kill-tabtip', () => {
  log('TEST', '═══ Manual TabTip kill triggered ═══');
  tabTipOpen = true;
  lastOpenAttempt = 0;
  closeTabTip();
});
ipcMain.on('debug-rerun-diagnostics', () => runDiagnostics());

// ============================================================
// Window
// ============================================================
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(KIOSK_URL);

  mainWindow.webContents.on('did-finish-load', () => {
    log('OK', `✓ Page loaded: ${KIOSK_URL}`);
    runDiagnostics();
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    log('ERROR', `Page failed to load: ${code} ${desc}`);
  });

  // Hotkeys (work even in kiosk mode)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && input.control && input.shift) {
      log('INFO', 'Ctrl+Shift+Esc → quitting');
      app.quit();
    }
    if (input.key === 'D' && input.control && input.shift) {
      mainWindow.webContents.send('debug-toggle');
    }
  });

  mainWindow.on('blur', () => closeTabTip());
  mainWindow.on('closed', () => closeTabTip());
}

app.whenReady().then(() => {
  log('INFO', '═══ App ready ═══');
  createWindow();
});

app.on('window-all-closed', () => { closeTabTip(); app.quit(); });
app.on('before-quit', () => closeTabTip());
