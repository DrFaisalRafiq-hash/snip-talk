// Mini-mode persistence + Electron bridge sync.
// Mini mode shrinks the window to a quick snippet picker; the toggle is stored
// in localStorage so reloads land in the same mode, and the Electron tray/main
// process is notified so the OS window can actually resize.

type ElectronBridge = {
  setMiniMode?: (enabled: boolean) => Promise<unknown> | unknown;
};

const MINI_KEY = "sniptalk:miniMode";

export const MINI_W = 420;
export const MINI_H = 640;

export function isMiniMode(): boolean {
  try {
    return localStorage.getItem(MINI_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMiniMode(enabled: boolean) {
  try {
    localStorage.setItem(MINI_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
  // Talk to Electron tray/main if present so the OS window actually shrinks.
  const bridge = (window as unknown as { sniptalk?: ElectronBridge }).sniptalk;
  if (bridge?.setMiniMode) {
    try {
      bridge.setMiniMode(enabled);
    } catch {
      /* ignore */
    }
  }
  // Reflect on <html> so layout-level styles can react if needed.
  document.documentElement.classList.toggle("mini-mode", enabled);
  // In a regular browser window, also try resizeTo (only works for windows
  // opened via window.open, but is a no-op otherwise — safe to call).
  if (enabled) {
    try {
      window.resizeTo(MINI_W, MINI_H);
    } catch {
      /* ignore */
    }
  }
}
