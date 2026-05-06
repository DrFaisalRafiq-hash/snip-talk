// Menu-bar (tray) mode for Snip Talk on macOS.
// Run with: npm run electron:tray
//
// Reuses the same Vite bundle as the main window. The tray window is a
// frameless, always-on-top popover that opens beneath the menubar icon.
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  shell,
  systemPreferences,
  screen,
  session,
  globalShortcut,
  ipcMain,
  clipboard,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");

const SETTINGS_PATH = path.join(app.getPath("userData"), "tray-settings.json");
const DEFAULT_ACCELERATOR = "CommandOrControl+Shift+D";

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
  } catch {
    return {};
  }
}
function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  try {
    fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next));
  } catch {}
  return next;
}
function getAccelerator() {
  return readSettings().toggleAccelerator || DEFAULT_ACCELERATOR;
}

app.setName("Snip Talk");
if (process.platform === "darwin") {
  // Hide from Dock — menubar-only experience
  app.dock?.hide();
}

const isDev = !app.isPackaged && process.env.ELECTRON_START_URL;
const WIN_W = 380;
const WIN_H = 560;

let tray = null;
let win = null;

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob: https:; font-src 'self' data:; media-src 'self' blob:; " +
  "connect-src 'self' https://urwovlmueuxgolccrjhb.supabase.co wss://urwovlmueuxgolccrjhb.supabase.co " +
  "https://api.elevenlabs.io wss://api.elevenlabs.io; " +
  "worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; object-src 'none';";

function buildTrayIcon() {
  // Simple template image — three dots; macOS auto-tints in light/dark menubar
  const img = nativeImage.createFromPath(path.join(__dirname, "tray-icon.png"));
  if (!img.isEmpty()) {
    img.setTemplateImage(true);
    return img;
  }
  // Fallback: tiny built-in placeholder so the tray still appears
  return nativeImage.createEmpty();
}

function createWindow() {
  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    show: false,
    frame: false,
    fullscreenable: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: false,
    backgroundColor: "#f5f3ee",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (isDev) {
    win.loadURL(`${process.env.ELECTRON_START_URL}?tray=1&deeplink=sniptalk%3A%2F%2Fdictate`);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"), {
      search: "tray=1&deeplink=" + encodeURIComponent("sniptalk://dictate"),
    });
  }

  win.on("blur", () => {
    if (!win.webContents.isDevToolsOpened()) win.hide();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
}

function positionWindow() {
  const bounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
  const workArea = display.workArea;
  // Center horizontally under the tray icon, clamped to display
  let x = Math.round(bounds.x + bounds.width / 2 - WIN_W / 2);
  let y = Math.round(bounds.y + bounds.height + 4);
  x = Math.max(workArea.x + 8, Math.min(x, workArea.x + workArea.width - WIN_W - 8));
  y = Math.max(workArea.y + 8, y);
  win.setBounds({ x, y, width: WIN_W, height: WIN_H });
}

function toggleWindow() {
  if (!win) return;
  if (win.isVisible()) {
    win.hide();
  } else {
    positionWindow();
    win.show();
    win.focus();
  }
}

function toggleDictationFromShortcut() {
  if (!win) return;
  if (!win.isVisible()) {
    positionWindow();
    win.show();
    win.focus();
  }
  win.webContents.send("deep-link", "sniptalk://dictate?mode=toggle");
}

function registerGlobalShortcut(accelerator) {
  globalShortcut.unregisterAll();
  if (!accelerator) return { ok: false, error: "empty" };
  try {
    const ok = globalShortcut.register(accelerator, toggleDictationFromShortcut);
    return ok ? { ok: true } : { ok: false, error: "failed" };
  } catch (e) {
    return { ok: false, error: e?.message || "invalid" };
  }
}

function buildTrayMenu() {
  const accel = getAccelerator();
  return Menu.buildFromTemplate([
    { label: "Open Snip Talk", click: toggleWindow },
    {
      label: `Toggle dictation  (${accel})`,
      click: toggleDictationFromShortcut,
      accelerator: accel,
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
}

ipcMain.handle("tray:get-shortcut", () => ({
  accelerator: getAccelerator(),
  default: DEFAULT_ACCELERATOR,
}));

ipcMain.handle("tray:set-shortcut", (_e, accelerator) => {
  const next = String(accelerator || "").trim() || DEFAULT_ACCELERATOR;
  const result = registerGlobalShortcut(next);
  if (result.ok) {
    writeSettings({ toggleAccelerator: next });
    if (tray) tray.setContextMenu(buildTrayMenu());
  }
  return { ...result, accelerator: next };
});

app.whenReady().then(async () => {
  // CSP + permission lockdown (microphone only)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [CSP],
        "X-Content-Type-Options": ["nosniff"],
        "Referrer-Policy": ["strict-origin-when-cross-origin"],
      },
    });
  });
  session.defaultSession.setPermissionRequestHandler((_wc, p, cb) => cb(p === "media"));

  if (process.platform === "darwin") {
    try {
      const status = systemPreferences.getMediaAccessStatus("microphone");
      if (status === "not-determined") {
        systemPreferences.askForMediaAccess("microphone").catch(() => {});
      }
    } catch {}
  }

  tray = new Tray(buildTrayIcon());
  tray.setToolTip("Snip Talk");
  tray.on("click", toggleWindow);
  tray.on("right-click", () => tray.popUpContextMenu(buildTrayMenu()));

  createWindow();

  // Register the saved global accelerator (or default)
  const result = registerGlobalShortcut(getAccelerator());
  if (!result.ok) {
    console.warn(`[tray] global shortcut "${getAccelerator()}" failed: ${result.error}`);
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", (e) => {
  // Keep the app alive in the tray
  e.preventDefault?.();
});
