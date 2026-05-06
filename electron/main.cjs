// Electron main process. Loads the built Vite app from /dist.
// Run with: npx electron . (after `npm run build`)
const {
  app,
  BrowserWindow,
  shell,
  systemPreferences,
  ipcMain,
  session,
} = require("electron");
const path = require("path");
const { URL: NodeURL } = require("url");

app.setName("Snip Talk");

// Origins the renderer is allowed to navigate to / talk to
const ALLOWED_ORIGINS = new Set([
  "https://urwovlmueuxgolccrjhb.supabase.co",
  "https://api.elevenlabs.io",
]);

const CSP =
  "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob: https:; " +
  "font-src 'self' data:; " +
  "media-src 'self' blob:; " +
  "connect-src 'self' https://urwovlmueuxgolccrjhb.supabase.co wss://urwovlmueuxgolccrjhb.supabase.co https://api.elevenlabs.io wss://api.elevenlabs.io; " +
  "worker-src 'self' blob:; " +
  "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';";

function safeUrl(value) {
  try {
    return value ? new NodeURL(value) : null;
  } catch {
    return null;
  }
}

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
let splashWindow = null;
let pendingDeepLink = null; // queued until renderer is ready

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
  const splashPath = path.join(__dirname, "splash.html");
  splashWindow.loadFile(splashPath);
  splashWindow.on("closed", () => { splashWindow = null; });
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
  }
}

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

  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  // Block navigation away from the app shell
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const target = safeUrl(url);
    const devOrigin = safeUrl(process.env.ELECTRON_START_URL)?.origin;
    const allowed =
      target?.protocol === "file:" ||
      (isDev && target?.origin && target.origin === devOrigin) ||
      (target && ALLOWED_ORIGINS.has(target.origin));
    if (!allowed) {
      event.preventDefault();
      if (target && /^https?:$/.test(target.protocol)) shell.openExternal(url);
    }
  });

  // Route window.open / target=_blank to the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const target = safeUrl(url);
    if (target && /^https?:$/.test(target.protocol)) shell.openExternal(url);
    return { action: "deny" };
  });

  // Defense in depth — webview is already disabled
  mainWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());

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
  // ---- Inject CSP header for every renderer response ----
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [CSP],
        "X-Content-Type-Options": ["nosniff"],
        "Referrer-Policy": ["strict-origin-when-cross-origin"],
        "X-Frame-Options": ["DENY"],
      },
    });
  });

  // ---- Permission gating: only allow what we actually need ----
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media"); // microphone only
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return permission === "media";
  });

  // ---- Block unauthorized cross-origin sub-resource loads (extra safety net) ----
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const u = safeUrl(details.url);
    if (!u) return callback({});
    const okScheme =
      u.protocol === "file:" ||
      u.protocol === "data:" ||
      u.protocol === "blob:" ||
      u.protocol === "devtools:" ||
      u.protocol === "chrome-extension:";
    if (okScheme) return callback({});
    const devOrigin = safeUrl(process.env.ELECTRON_START_URL)?.origin;
    const okOrigin =
      ALLOWED_ORIGINS.has(u.origin) ||
      (isDev && u.origin === devOrigin) ||
      // websockets to allowlisted hosts
      ((u.protocol === "ws:" || u.protocol === "wss:") &&
        ALLOWED_ORIGINS.has(`https://${u.host}`));
    callback(okOrigin ? {} : { cancel: true });
  });

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

// Apply navigation hardening to every webContents that gets created
app.on("web-contents-created", (_event, contents) => {
  contents.on("will-attach-webview", (e) => e.preventDefault());
  contents.setWindowOpenHandler(({ url }) => {
    const target = safeUrl(url);
    if (target && /^https?:$/.test(target.protocol)) shell.openExternal(url);
    return { action: "deny" };
  });
});
