// Electron main process — Kiosk wrapper for הבקתה
// Loads the live website and bridges TabTip.exe (Windows Touch Keyboard)
// to input focus/blur events from the page.

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');

// ============================================================
// Config — edit these if needed
// ============================================================
const KIOSK_URL = process.env.KIOSK_URL || 'https://yum-order-maker.lovable.app/kiosk';
const TABTIP_PATH = 'C:\\Program Files\\Common Files\\microsoft shared\\ink\\TabTip.exe';

// ============================================================
// TabTip controller — open/close Windows Touch Keyboard
// ============================================================
let tabTipOpen = false;
let pendingAction = null; // debounce focus/blur churn

function openTabTip() {
  if (tabTipOpen) return;
  tabTipOpen = true;
  try {
    // Detached so we don't keep a handle on it
    const child = spawn(TABTIP_PATH, [], { detached: true, stdio: 'ignore' });
    child.unref();
  } catch (err) {
    console.error('[TabTip] failed to open:', err);
    tabTipOpen = false;
  }
}

function closeTabTip() {
  if (!tabTipOpen) return;
  tabTipOpen = false;
  // The reliable way to dismiss TabTip is to kill the process.
  // It will be re-spawned on next focus.
  exec('taskkill /IM TabTip.exe /F', (err) => {
    if (err) {
      // Not fatal — the keyboard may already be gone
      // console.warn('[TabTip] taskkill warning:', err.message);
    }
  });
}

// Debounce so quickly tabbing between inputs doesn't flicker the keyboard
function scheduleAction(action) {
  if (pendingAction) clearTimeout(pendingAction);
  pendingAction = setTimeout(() => {
    pendingAction = null;
    if (action === 'open') openTabTip();
    else closeTabTip();
  }, 120);
}

ipcMain.on('input-focus', () => scheduleAction('open'));
ipcMain.on('input-blur', () => scheduleAction('close'));

// ============================================================
// Window
// ============================================================
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
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

  win.setMenuBarVisibility(false);
  win.loadURL(KIOSK_URL);

  // Allow Esc to exit kiosk (for setup/maintenance)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && input.control && input.shift) {
      app.quit();
    }
  });

  // Always close keyboard when window loses focus / closes
  win.on('blur', () => closeTabTip());
  win.on('closed', () => closeTabTip());
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  closeTabTip();
  app.quit();
});

app.on('before-quit', () => closeTabTip());
