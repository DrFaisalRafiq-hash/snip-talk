// Preload runs in an isolated context with access to Node + the DOM.
// We expose a tiny, typed surface to the renderer for deep-link events.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sniptalk", {
  /**
   * Subscribe to deep-link URLs (sniptalk://...) opened from the OS.
   * Returns an unsubscribe function.
   */
  onDeepLink(handler) {
    const listener = (_event, url) => {
      try {
        handler(url);
      } catch {
        /* swallow renderer errors */
      }
    };
    ipcRenderer.on("deep-link", listener);
    return () => ipcRenderer.removeListener("deep-link", listener);
  },
  /** Ask main for the URL the app was launched with (if any). */
  getInitialDeepLink() {
    return ipcRenderer.invoke("deep-link:initial");
  },
  isElectron: true,
  /** Tray-only: read the current global shortcut accelerator. */
  getGlobalShortcut() {
    return ipcRenderer.invoke("tray:get-shortcut");
  },
  /** Tray-only: persist & re-register the global shortcut accelerator. */
  setGlobalShortcut(accelerator) {
    return ipcRenderer.invoke("tray:set-shortcut", accelerator);
  },
  /** Tray-only: replace the full snippet→accelerator binding list. */
  setSnippetShortcuts(bindings) {
    return ipcRenderer.invoke("tray:set-snippet-shortcuts", bindings);
  },
  /** Tray-only: check macOS Accessibility trust status; pass true to prompt. */
  getAccessibilityStatus(prompt = false) {
    return ipcRenderer.invoke("tray:accessibility-status", prompt);
  },
  /** Tray-only: open System Settings → Privacy & Security → Accessibility. */
  openAccessibilitySettings() {
    return ipcRenderer.invoke("tray:open-accessibility-settings");
  },
  /** Tray-only: subscribe to "snippet pasted" notifications. */
  onSnippetPasted(handler) {
    const listener = (_e, payload) => {
      try { handler(payload); } catch {}
    };
    ipcRenderer.on("snippet:pasted", listener);
    return () => ipcRenderer.removeListener("snippet:pasted", listener);
  },
  /** Tray-only: subscribe to paste-error notifications (e.g. missing Accessibility). */
  onSnippetPasteError(handler) {
    const listener = (_e, message) => {
      try { handler(message); } catch {}
    };
    ipcRenderer.on("snippet:paste-error", listener);
    return () => ipcRenderer.removeListener("snippet:paste-error", listener);
  },
});
