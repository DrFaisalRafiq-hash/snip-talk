const DEFAULT_URL = "https://id-preview--d2c71d2a-b9b8-464c-9c92-fb327a9fdabe.lovable.app";

const urlInput = document.getElementById("base-url");

chrome.storage.local.get(["baseUrl"], ({ baseUrl }) => {
  urlInput.value = baseUrl || DEFAULT_URL;
});

urlInput.addEventListener("change", () => {
  let v = urlInput.value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  chrome.storage.local.set({ baseUrl: v });
});

function open(target) {
  const base = (urlInput.value || DEFAULT_URL).trim().replace(/\/+$/, "");
  // Reuse the in-app deeplink fallback (?deeplink=sniptalk://...)
  const url = target
    ? `${base}/?deeplink=${encodeURIComponent("sniptalk://" + target)}`
    : base;
  chrome.tabs.create({ url });
  window.close();
}

document.querySelectorAll("[data-target]").forEach((el) => {
  el.addEventListener("click", () => open(el.dataset.target));
});
document.getElementById("open-app").addEventListener("click", () => open(null));

// Keyboard shortcuts inside the popup
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") open("dictate");
  else if (e.key.toLowerCase() === "s") open("snippets");
});
