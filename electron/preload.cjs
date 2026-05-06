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
});
