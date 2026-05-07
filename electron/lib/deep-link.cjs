// sniptalk:// deep-link plumbing: cold-start from argv, macOS open-url events,
// Windows/Linux second-instance argv, and an IPC handler for the renderer to
// query the URL the app was launched with. The caller registers a single
// "deliver" function that knows where to route a delivered URL.

const { app, ipcMain } = require("electron");
const path = require("path");

const PROTOCOL = "sniptalk";

let pendingDeepLink = null;

function extractDeepLink(argv) {
  if (!argv) return null;
  return argv.find((a) => typeof a === "string" && a.startsWith(`${PROTOCOL}://`)) || null;
}

function registerProtocolClient() {
  // Custom protocol so the OS routes sniptalk:// URLs to this app.
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
}

// Wire the OS-level events. `deliver` receives the URL when there's a window
// ready to handle it; otherwise we queue it and deliver on did-finish-load.
function registerHandlers({ deliver, onSecondInstanceFocus }) {
  // macOS: protocol delivered via 'open-url'
  app.on("open-url", (event, url) => {
    event.preventDefault();
    if (!deliver(url)) pendingDeepLink = url;
  });

  // Windows/Linux: protocol delivered via second-instance argv
  app.on("second-instance", (_event, argv) => {
    const url = extractDeepLink(argv);
    if (url) {
      if (!deliver(url)) pendingDeepLink = url;
    } else if (onSecondInstanceFocus) {
      onSecondInstanceFocus();
    }
  });

  // Renderer can ask for the URL the app was cold-launched with.
  ipcMain.handle("deep-link:initial", () => {
    const url = pendingDeepLink || extractDeepLink(process.argv);
    pendingDeepLink = null;
    return url;
  });
}

function takePendingDeepLink() {
  const url = pendingDeepLink;
  pendingDeepLink = null;
  return url;
}

function setPendingDeepLink(url) {
  if (url) pendingDeepLink = url;
}

module.exports = {
  PROTOCOL,
  extractDeepLink,
  registerProtocolClient,
  registerHandlers,
  takePendingDeepLink,
  setPendingDeepLink,
};
