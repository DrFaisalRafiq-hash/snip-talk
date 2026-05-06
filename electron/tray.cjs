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
    movable: true,
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

  const persistPosition = () => {
    if (!win || win.isDestroyed() || !win.isVisible()) return;
    const [x, y] = win.getPosition();
    const display = screen.getDisplayNearestPoint({ x, y });
    savePopoverPosition(x, y, display.id);
  };
  win.on("moved", persistPosition);
  win.on("move", persistPosition);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
}

function positionWindow() {
  const bounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
  const workArea = display.workArea;

  // Try to reuse the last saved position if it still fits on this display.
  const saved = readSettings().popoverPosition;
  if (
    saved &&
    typeof saved.x === "number" &&
    typeof saved.y === "number" &&
    saved.displayId === display.id &&
    saved.x >= workArea.x &&
    saved.y >= workArea.y &&
    saved.x + WIN_W <= workArea.x + workArea.width &&
    saved.y + WIN_H <= workArea.y + workArea.height
  ) {
    win.setBounds({ x: saved.x, y: saved.y, width: WIN_W, height: WIN_H });
    return;
  }

  // Default: center horizontally under the tray icon, clamped to display
  let x = Math.round(bounds.x + bounds.width / 2 - WIN_W / 2);
  let y = Math.round(bounds.y + bounds.height + 4);
  x = Math.max(workArea.x + 8, Math.min(x, workArea.x + workArea.width - WIN_W - 8));
  y = Math.max(workArea.y + 8, y);
  win.setBounds({ x, y, width: WIN_W, height: WIN_H });
  savePopoverPosition(x, y, display.id);
}

function savePopoverPosition(x, y, displayId) {
  writeSettings({ popoverPosition: { x, y, displayId } });
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

// In-memory list of snippet bindings supplied by the renderer.
// [{ id, accelerator, content, title }]
let snippetBindings = [];

function pasteViaAppleScript() {
  if (process.platform !== "darwin") return;
  // Requires Accessibility permission (System Settings > Privacy & Security > Accessibility)
  execFile(
    "osascript",
    ["-e", 'tell application "System Events" to keystroke "v" using command down'],
    (err) => {
      if (err) {
        // Likely missing Accessibility permission. Trigger the prompt.
        try {
          systemPreferences.isTrustedAccessibilityClient(true);
        } catch {}
        if (win && !win.isDestroyed()) {
          win.webContents.send(
            "snippet:paste-error",
            "Accessibility permission required to paste. Enable Snip Talk under System Settings → Privacy & Security → Accessibility."
          );
        }
      }
    }
  );
}

function pasteSnippet(binding) {
  if (!binding) return;
  clipboard.writeText(binding.content || "");
  // Tiny delay so the active app sees the new clipboard contents
  setTimeout(pasteViaAppleScript, 60);
  if (win && !win.isDestroyed()) {
    win.webContents.send("snippet:pasted", { id: binding.id, title: binding.title });
  }
}

function registerAllShortcuts() {
  globalShortcut.unregisterAll();
  const results = { toggle: { ok: false }, snippets: [] };

  const toggleAccel = getAccelerator();
  try {
    const ok = globalShortcut.register(toggleAccel, toggleDictationFromShortcut);
    results.toggle = ok ? { ok: true, accelerator: toggleAccel } : { ok: false, accelerator: toggleAccel, error: "failed" };
  } catch (e) {
    results.toggle = { ok: false, accelerator: toggleAccel, error: e?.message || "invalid" };
  }

  for (const b of snippetBindings) {
    if (!b?.accelerator) continue;
    try {
      const ok = globalShortcut.register(b.accelerator, () => pasteSnippet(b));
      results.snippets.push({ id: b.id, accelerator: b.accelerator, ok, error: ok ? undefined : "conflict" });
    } catch (e) {
      results.snippets.push({ id: b.id, accelerator: b.accelerator, ok: false, error: e?.message || "invalid" });
    }
  }
  return results;
}

function registerGlobalShortcut(accelerator) {
  // Back-compat wrapper for the toggle-only path used by `tray:set-shortcut`
  const next = String(accelerator || "").trim() || DEFAULT_ACCELERATOR;
  writeSettings({ toggleAccelerator: next });
  const r = registerAllShortcuts();
  return r.toggle.ok ? { ok: true } : { ok: false, error: r.toggle.error || "failed" };
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
  // Persist first so registerAllShortcuts picks up the new value
  writeSettings({ toggleAccelerator: next });
  const r = registerAllShortcuts();
  if (r.toggle.ok && tray) tray.setContextMenu(buildTrayMenu());
  return { ...r.toggle, accelerator: next };
});

ipcMain.handle("tray:set-snippet-shortcuts", (_e, bindings) => {
  snippetBindings = Array.isArray(bindings)
    ? bindings
        .filter((b) => b && b.id && b.accelerator)
        .map((b) => ({
          id: String(b.id),
          accelerator: String(b.accelerator),
          content: String(b.content ?? ""),
          title: String(b.title ?? ""),
        }))
    : [];
  return registerAllShortcuts();
});

ipcMain.handle("tray:accessibility-status", (_e, prompt = false) => {
  if (process.platform !== "darwin") return { trusted: true, supported: false };
  try {
    return {
      trusted: systemPreferences.isTrustedAccessibilityClient(!!prompt),
      supported: true,
    };
  } catch {
    return { trusted: false, supported: true };
  }
});

ipcMain.handle("tray:open-accessibility-settings", () => {
  if (process.platform !== "darwin") return false;
  shell.openExternal(
    "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
  );
  return true;
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
