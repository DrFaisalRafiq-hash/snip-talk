import { loadSettings, buildUrl, openTarget } from "./settings.js";

const rowsEl = document.getElementById("rows");
const baseDisplay = document.getElementById("base-display");
let settings;

function render() {
  rowsEl.innerHTML = "";
  const visible = settings.targets.filter((t) => t.enabled);
  visible.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = "row";
    btn.innerHTML = `${escapeHtml(t.label)}${t.key ? `<span class="k">${escapeHtml(t.key)}</span>` : ""}`;
    btn.addEventListener("click", () => {
      openTarget(buildUrl(settings.baseUrl, t.id), settings.openMode);
      window.close();
    });
    rowsEl.appendChild(btn);
  });
  try {
    baseDisplay.textContent = new URL(settings.baseUrl).host;
  } catch {
    baseDisplay.textContent = "";
  }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

document.getElementById("open-options").addEventListener("click", () => {
  if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
  else chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
  window.close();
});

document.addEventListener("keydown", (e) => {
  if (!settings) return;
  const match = settings.targets.find(
    (t) => t.enabled && t.key && (e.key === t.key || e.key.toLowerCase() === t.key.toLowerCase())
  );
  if (match) {
    openTarget(buildUrl(settings.baseUrl, match.id), settings.openMode);
    window.close();
  }
});

(async () => {
  settings = await loadSettings();
  render();
})();
