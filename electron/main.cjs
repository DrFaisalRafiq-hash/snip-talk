// Electron main process. Loads the built Vite app from /dist.
// Run with: npx electron . (after `npm run build`)
const { app, BrowserWindow, shell, systemPreferences } = require("electron");
const path = require("path");

app.setName("Snip Talk");

const isDev = !app.isPackaged && process.env.ELECTRON_START_URL;

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    titleBarStyle: "hiddenInset", // native macOS traffic lights overlay
    backgroundColor: "#f5f3ee",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL(process.env.ELECTRON_START_URL);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  // Open external links in the user's browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

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
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
