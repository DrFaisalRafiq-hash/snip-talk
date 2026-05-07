// Persistent settings for the tray window. Written as JSON next to the
// userData dir; failures are logged but never thrown so a read-only volume
// never crashes the app.

const { app } = require("electron");
const fs = require("fs");
const path = require("path");

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
  } catch (err) {
    console.warn(`[tray] failed to persist settings to ${SETTINGS_PATH}: ${err?.message ?? err}`);
  }
  return next;
}

function getAccelerator() {
  return readSettings().toggleAccelerator || DEFAULT_ACCELERATOR;
}

function savePopoverPosition(x, y, displayId) {
  writeSettings({ popoverPosition: { x, y, displayId } });
}

module.exports = {
  DEFAULT_ACCELERATOR,
  SETTINGS_PATH,
  readSettings,
  writeSettings,
  getAccelerator,
  savePopoverPosition,
};
