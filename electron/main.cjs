// Electron main process. Loads the built Vite app from /dist.
// Run with: npx electron . (after `npm run build`)
const {
  app,
  BrowserWindow,
  shell,
  systemPreferences,
  ipcMain,
} = require("electron");
const path = require("path");

app.setName("Snip Talk");

const PROTOCOL = "sniptalk";
const isDev = !app.isPackaged && process.env.ELECTRON_START_URL;

// ---- Single-instance lock so deep links re-focus the running app ----
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// ---- Register custom protocol (sniptalk://) ----
if (process.defaultApp) {
  // running via `electron .` — argv form lets dev launches register too
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

let mainWindow = null;
let pendingDeepLink = null; // queued until renderer is ready

function extractDeepLink(argv) {
  if (!argv) return null;
  return argv.find((a) => typeof a === "string" && a.startsWith(`${PROTOCOL}://`)) || null;
}

function deliverDeepLink(url) {
  if (!url) return;
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send("deep-link", url);
  } else {
    pendingDeepLink = url;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#f5f3ee",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-finish-load", () => {
    if (pendingDeepLink) {
      mainWindow.webContents.send("deep-link", pendingDeepLink);
      pendingDeepLink = null;
    }
  });
}

// ---- macOS: protocol delivered via 'open-url' ----
app.on("open-url", (event, url) => {
  event.preventDefault();
  if (mainWindow) {
    deliverDeepLink(url);
  } else {
    pendingDeepLink = url;
  }
});

// ---- Windows/Linux: protocol delivered via second-instance argv ----
app.on("second-instance", (_event, argv) => {
  const url = extractDeepLink(argv);
  if (url) deliverDeepLink(url);
  else if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// Renderer can ask for the URL the app was cold-launched with
ipcMain.handle("deep-link:initial", () => {
  const url = pendingDeepLink || extractDeepLink(process.argv);
  pendingDeepLink = null;
  return url;
});

app.whenReady().then(async () => {
  if (process.platform === "darwin") {
    try {
      const status = systemPreferences.getMediaAccessStatus("microphone");
      if (status === "not-determined") {
        await systemPreferences.askForMediaAccess("microphone");
      }
    } catch {
      // ignore — renderer surfaces a friendly error if denied
    }
  }
  // Capture cold-start deep link from argv (Windows/Linux)
  const initial = extractDeepLink(process.argv);
  if (initial) pendingDeepLink = initial;

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
