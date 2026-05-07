// Frameless popover window for the tray. Stays beneath the menubar icon by
// default but remembers the last position the user dragged it to. Pure
// presentation — the caller wires global shortcuts and IPC.

const { BrowserWindow, screen, shell } = require("electron");
const path = require("path");
const { readSettings, savePopoverPosition } = require("./tray-settings.cjs");

const WIN_W = 380;
const WIN_H = 560;

function createTrayWindow({ isDev }) {
  const win = new BrowserWindow({
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
      preload: path.join(__dirname, "..", "preload.cjs"),
    },
  });

  if (isDev) {
    win.loadURL(`${process.env.ELECTRON_START_URL}?tray=1&deeplink=sniptalk%3A%2F%2Fdictate`);
  } else {
    win.loadFile(path.join(__dirname, "..", "..", "dist", "index.html"), {
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

  return win;
}

// Position the popover beneath the tray icon, reusing the last saved spot if
// it still fits on the current display.
function positionTrayWindow(win, tray) {
  const bounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
  const workArea = display.workArea;

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

  let x = Math.round(bounds.x + bounds.width / 2 - WIN_W / 2);
  let y = Math.round(bounds.y + bounds.height + 4);
  x = Math.max(workArea.x + 8, Math.min(x, workArea.x + workArea.width - WIN_W - 8));
  y = Math.max(workArea.y + 8, y);
  win.setBounds({ x, y, width: WIN_W, height: WIN_H });
  savePopoverPosition(x, y, display.id);
}

module.exports = { WIN_W, WIN_H, createTrayWindow, positionTrayWindow };
