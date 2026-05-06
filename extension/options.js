import {
  DEFAULT_URL,
  DEFAULT_TARGETS,
  DEFAULT_OPEN_MODE,
  loadSettings,
  saveSettings,
} from "./settings.js";

const baseInput = document.getElementById("base-url");
const modeSelect = document.getElementById("open-mode");
const targetsEl = document.getElementById("targets");
const statusEl = document.getElementById("status");

let state = { baseUrl: DEFAULT_URL, targets: DEFAULT_TARGETS, openMode: DEFAULT_OPEN_MODE };

function renderTargets() {
  targetsEl.innerHTML = "";
  state.targets.forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "target-row";
    row.innerHTML = `
      <input type="checkbox" data-i="${i}" data-field="enabled" ${t.enabled ? "checked" : ""} />
      <input type="text" data-i="${i}" data-field="label" value="${escapeAttr(t.label)}" placeholder="Button label" />
      <input type="text" class="mono" data-i="${i}" data-field="id" value="${escapeAttr(t.id)}" placeholder="dictate" />
      <input type="text" class="mono" data-i="${i}" data-field="key" value="${escapeAttr(t.key)}" placeholder="⏎" />
    `;
    targetsEl.appendChild(row);
  });
  targetsEl.querySelectorAll("input").forEach((el) => {
    el.addEventListener("input", (e) => {
      const i = +e.target.dataset.i;
      const f = e.target.dataset.field;
      state.targets[i][f] = f === "enabled" ? e.target.checked : e.target.value;
    });
  });
}

function escapeAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;");
}

function flash(msg) {
  statusEl.textContent = msg;
  setTimeout(() => (statusEl.textContent = ""), 1800);
}

async function init() {
  state = await loadSettings();
  baseInput.value = state.baseUrl;
  modeSelect.value = state.openMode;
  renderTargets();
}

document.getElementById("save").addEventListener("click", async () => {
  let url = baseInput.value.trim().replace(/\/+$/, "");
  if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
  state.baseUrl = url || DEFAULT_URL;
  state.openMode = modeSelect.value;
  await saveSettings({
    baseUrl: state.baseUrl,
    openMode: state.openMode,
    targets: state.targets,
  });
  flash("Saved ✓");
});

document.getElementById("reset").addEventListener("click", async () => {
  state = { baseUrl: DEFAULT_URL, targets: structuredClone(DEFAULT_TARGETS), openMode: DEFAULT_OPEN_MODE };
  baseInput.value = state.baseUrl;
  modeSelect.value = state.openMode;
  renderTargets();
  await saveSettings(state);
  flash("Reset to defaults");
});

init();
