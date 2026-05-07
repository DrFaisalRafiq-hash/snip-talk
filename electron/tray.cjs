// Menu-bar (tray) mode for Snip Talk on macOS.
// Run with: npm run electron:tray
//
// Reuses the same Vite bundle as the main window. The tray window is a
// frameless, always-on-top popover that opens beneath the menubar icon.
const {
  app,
  Tray,
  nativeImage,
  shell,
  systemPreferences,
  session,
  globalShortcut,
  ipcMain,
} = require("electron");
const path = require("path");

const {
  TRAY_CSP,
  applyCspHeaders,
  applyMediaOnlyPermissions,
} = require("./lib/security.cjs");
const {
  DEFAULT_ACCELERATOR,
  getAccelerator,
} = require("./lib/tray-settings.cjs");
const { createTrayWindow, positionTrayWindow } = require("./lib/tray-window.cjs");
const { createShortcutManager } = require("./lib/tray-shortcuts.cjs");
const { buildTrayMenu } = require("./lib/tray-menu.cjs");

app.setName("Snip Talk");
if (process.platform === "darwin") {
  // Hide from Dock — menubar-only experience
  app.dock?.hide();
}

const isDev = !app.isPackaged && process.env.ELECTRON_START_URL;

let tray = null;
let win = null;
let traySnippets = [];

const getWindow = () => win;

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

function toggleWindow() {
  if (!win) return;
  if (win.isVisible()) {
    win.hide();
  } else {
    positionTrayWindow(win, tray);
    win.show();
    win.focus();
  }
}

function toggleDictationFromShortcut() {
  if (!win) return;
  if (!win.isVisible()) {
    positionTrayWindow(win, tray);
    win.show();
    win.focus();
  }
  win.webContents.send("deep-link", "sniptalk://dictate?mode=toggle");
}

function refreshTrayMenu(accelerator = getAccelerator()) {
  if (!tray) return;
  tray.setContextMenu(
    buildTrayMenu({
      accelerator,
      snippets: traySnippets,
      onOpenWindow: toggleWindow,
      onToggleDictation: toggleDictationFromShortcut,
      getWindow,
    }),
  );
}

const shortcuts = createShortcutManager({
  onToggle: toggleDictationFromShortcut,
  getWindow,
});

ipcMain.handle("tray:set-snippets", (_e, list) => {
  traySnippets = Array.isArray(list)
    ? list
        .filter((s) => s && s.id)
        .map((s) => ({
          id: String(s.id),
          title: String(s.title ?? ""),
          content: String(s.content ?? ""),
        }))
    : [];
  refreshTrayMenu();
  return { ok: true, count: traySnippets.length };
});

ipcMain.handle("tray:get-shortcut", () => ({
  accelerator: getAccelerator(),
  default: DEFAULT_ACCELERATOR,
}));

ipcMain.handle("tray:set-shortcut", (_e, accelerator) => {
  const r = shortcuts.setToggleAccelerator(accelerator);
  if (r.toggle.ok) refreshTrayMenu(r.toggle.accelerator);
  return { ...r.toggle, accelerator: r.toggle.accelerator || accelerator };
});

ipcMain.handle("tray:set-snippet-shortcuts", (_e, bindings) =>
  shortcuts.setSnippetBindings(bindings),
);

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
    "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
  );
  return true;
});

app.whenReady().then(async () => {
  applyCspHeaders(session.defaultSession, TRAY_CSP);
  applyMediaOnlyPermissions(session.defaultSession);

  if (process.platform === "darwin") {
    try {
      const status = systemPreferences.getMediaAccessStatus("microphone");
      if (status === "not-determined") {
        systemPreferences.askForMediaAccess("microphone").catch(() => {
          /* renderer surfaces a friendly error if denied */
        });
      }
    } catch {
      /* ignore */
    }
  }

  tray = new Tray(buildTrayIcon());
  tray.setToolTip("Snip Talk");
  tray.on("click", toggleWindow);
  tray.on("right-click", () => tray.popUpContextMenu(buildTrayMenu({
    accelerator: getAccelerator(),
    snippets: traySnippets,
    onOpenWindow: toggleWindow,
    onToggleDictation: toggleDictationFromShortcut,
    getWindow,
  })));
  refreshTrayMenu();

  win = createTrayWindow({ isDev });

  // Register the saved global accelerator (or default)
  const result = shortcuts.registerAll();
  if (!result.toggle.ok) {
    console.warn(
      `[tray] global shortcut "${getAccelerator()}" failed: ${result.toggle.error}`,
    );
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", (e) => {
  // Keep the app alive in the tray
  e.preventDefault?.();
});
