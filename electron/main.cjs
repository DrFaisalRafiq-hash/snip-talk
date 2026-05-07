// Electron main process. Loads the built Vite app from /dist.
// Run with: npx electron . (after `npm run build`)
const {
  app,
  BrowserWindow,
  systemPreferences,
  ipcMain,
  session,
} = require("electron");
const path = require("path");

const {
  loadBuildInfo,
  deriveVersionStamp,
  deriveShortCommit,
  configureAboutPanel,
} = require("./lib/build-info.cjs");
const {
  CSP,
  applyCspHeaders,
  applyMediaOnlyPermissions,
  applyResourceLoadGuard,
} = require("./lib/security.cjs");
const {
  applyWindowSecurity,
  applyDefaultWebContentsHardening,
} = require("./lib/window.cjs");
const deepLink = require("./lib/deep-link.cjs");

app.setName("Snip Talk");

// ---- Build info / version stamping ----
const BUILD_INFO = loadBuildInfo();
const APP_VERSION = BUILD_INFO.version || app.getVersion();
const VERSION_STAMP = deriveVersionStamp(BUILD_INFO, APP_VERSION);
const SHORT_COMMIT = deriveShortCommit(BUILD_INFO);
const WINDOW_TITLE = SHORT_COMMIT
  ? `Snip Talk · v${APP_VERSION} (${BUILD_INFO.build || "?"} · ${SHORT_COMMIT})`
  : `Snip Talk · v${APP_VERSION}`;

configureAboutPanel(app, BUILD_INFO, APP_VERSION, VERSION_STAMP);

const isDev = !app.isPackaged && process.env.ELECTRON_START_URL;

// Single-instance lock so deep links re-focus the running app.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

deepLink.registerProtocolClient();

let mainWindow = null;
let splashWindow = null;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 320,
    frame: false,
    transparent: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    show: true,
    backgroundColor: "#f5f3ee",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  splashWindow.loadFile(path.join(__dirname, "splash.html"));
  splashWindow.on("closed", () => {
    splashWindow = null;
  });
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
}

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function deliverDeepLinkToWindow(url) {
  if (!url) return false;
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    focusMainWindow();
    mainWindow.webContents.send("deep-link", url);
    return true;
  }
  return false;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    show: false,
    title: WINDOW_TITLE,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#f5f3ee",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      spellcheck: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    closeSplash();
    mainWindow.show();
    mainWindow.focus();
  });

  // Keep our version-stamped title even after the renderer sets <title>.
  mainWindow.on("page-title-updated", (event) => {
    event.preventDefault();
    mainWindow.setTitle(WINDOW_TITLE);
  });

  if (isDev) mainWindow.loadURL(process.env.ELECTRON_START_URL);
  else mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  applyWindowSecurity(mainWindow.webContents, { isDev });

  // Deliver any deep link that arrived before the renderer was ready.
  mainWindow.webContents.on("did-finish-load", () => {
    const url = deepLink.takePendingDeepLink();
    if (url) mainWindow.webContents.send("deep-link", url);
  });
}

deepLink.registerHandlers({
  deliver: deliverDeepLinkToWindow,
  onSecondInstanceFocus: focusMainWindow,
});

// About panel — exposes the version stamp / commit for the renderer.
ipcMain.handle("app:show-about", () => {
  if (typeof app.showAboutPanel === "function") app.showAboutPanel();
  return BUILD_INFO;
});

app.whenReady().then(async () => {
  applyCspHeaders(session.defaultSession, CSP, { "X-Frame-Options": ["DENY"] });
  // Auto-grant media (microphone) at the Electron layer so the renderer's
  // getUserMedia() does NOT trigger a second in-app prompt. The macOS OS-level
  // microphone prompt is handled separately, exactly once, below.
  applyMediaOnlyPermissions(session.defaultSession);
  applyResourceLoadGuard(session.defaultSession);

  // Capture cold-start deep link from argv (Windows/Linux).
  deepLink.setPendingDeepLink(deepLink.extractDeepLink(process.argv));

  // Show UI immediately — never block window creation on the OS mic prompt.
  createSplashWindow();
  createWindow();

  // ---- macOS microphone prompt: fire exactly once, AFTER the window exists ----
  // We intentionally do NOT await this. askForMediaAccess() shows the system
  // dialog only when status === "not-determined"; on subsequent launches the
  // status is already "granted"/"denied"/"restricted" and no prompt appears.
  if (process.platform === "darwin" && !global.__micPromptRequested) {
    global.__micPromptRequested = true;
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
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Apply navigation hardening to every webContents that gets created.
applyDefaultWebContentsHardening(app);
