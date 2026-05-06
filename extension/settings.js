// Shared settings helpers for the popup + options page.
export const DEFAULT_URL =
  "https://id-preview--d2c71d2a-b9b8-464c-9c92-fb327a9fdabe.lovable.app";

export const DEFAULT_TARGETS = [
  { id: "dictate", label: "Start dictation", key: "⏎", enabled: true },
  { id: "snippets", label: "Open snippets", key: "S", enabled: true },
  { id: "", label: "Open Snip Talk", key: "", enabled: true },
];

export const DEFAULT_OPEN_MODE = "new-tab"; // 'new-tab' | 'current-tab' | 'new-window' | 'popup-window'

export function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["baseUrl", "targets", "openMode"], (data) => {
      resolve({
        baseUrl: (data.baseUrl || DEFAULT_URL).replace(/\/+$/, ""),
        targets: Array.isArray(data.targets) && data.targets.length
          ? data.targets
          : DEFAULT_TARGETS,
        openMode: data.openMode || DEFAULT_OPEN_MODE,
      });
    });
  });
}

export function saveSettings(patch) {
  return new Promise((resolve) => chrome.storage.local.set(patch, resolve));
}

export function buildUrl(baseUrl, target) {
  const base = (baseUrl || DEFAULT_URL).trim().replace(/\/+$/, "");
  if (!target) return base;
  // Include both ?deeplink= (one-shot, fires commands) and #target
  // (persistent, survives reloads so the right tab stays selected).
  return `${base}/?deeplink=${encodeURIComponent("sniptalk://" + target)}#${target}`;
}

export function openTarget(url, mode) {
  switch (mode) {
    case "current-tab":
      return chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) chrome.tabs.update(tabs[0].id, { url });
        else chrome.tabs.create({ url });
      });
    case "new-window":
      return chrome.windows
        ? chrome.windows.create({ url })
        : chrome.tabs.create({ url });
    case "popup-window":
      return chrome.windows
        ? chrome.windows.create({ url, type: "popup", width: 420, height: 640 })
        : chrome.tabs.create({ url });
    case "new-tab":
    default:
      return chrome.tabs.create({ url });
  }
}
