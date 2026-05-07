// Per-window navigation + window.open hardening. Centralized so main and tray
// don't drift in their security posture.

const { shell } = require("electron");
const { ALLOWED_ORIGINS, safeUrl } = require("./security.cjs");

// Block navigation that leaves the app shell. file:// loads, the dev server
// (when running), and our allowlisted backend origins are permitted; anything
// else is opened in the system browser instead.
function applyWindowSecurity(webContents, { isDev = false } = {}) {
  webContents.on("will-navigate", (event, url) => {
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

  // Route window.open / target=_blank to the system browser.
  webContents.setWindowOpenHandler(({ url }) => {
    const target = safeUrl(url);
    if (target && /^https?:$/.test(target.protocol)) shell.openExternal(url);
    return { action: "deny" };
  });

  // Defense in depth — webview is already disabled.
  webContents.on("will-attach-webview", (event) => event.preventDefault());
}

// Apply the same window.open + webview gating to any webContents created at
// runtime (e.g. inside child windows). Call once on the `app` ready path.
function applyDefaultWebContentsHardening(app) {
  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-attach-webview", (e) => e.preventDefault());
    contents.setWindowOpenHandler(({ url }) => {
      const target = safeUrl(url);
      if (target && /^https?:$/.test(target.protocol)) shell.openExternal(url);
      return { action: "deny" };
    });
  });
}

module.exports = { applyWindowSecurity, applyDefaultWebContentsHardening };
