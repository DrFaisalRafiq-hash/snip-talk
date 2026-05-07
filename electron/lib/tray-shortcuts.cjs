// Global accelerator registration for the tray app: a single dictation-toggle
// shortcut plus N per-snippet paste shortcuts. Each registration result is
// reported back so the renderer can show conflict warnings.

const { globalShortcut } = require("electron");
const { getAccelerator, writeSettings, DEFAULT_ACCELERATOR } = require("./tray-settings.cjs");
const { pasteSnippet } = require("./tray-paste.cjs");

function createShortcutManager({ onToggle, getWindow }) {
  let snippetBindings = [];

  function registerAll() {
    globalShortcut.unregisterAll();
    const results = { toggle: { ok: false }, snippets: [] };

    const toggleAccel = getAccelerator();
    try {
      const ok = globalShortcut.register(toggleAccel, onToggle);
      results.toggle = ok
        ? { ok: true, accelerator: toggleAccel }
        : { ok: false, accelerator: toggleAccel, error: "failed" };
    } catch (e) {
      results.toggle = { ok: false, accelerator: toggleAccel, error: e?.message || "invalid" };
    }

    for (const b of snippetBindings) {
      if (!b?.accelerator) continue;
      try {
        const ok = globalShortcut.register(b.accelerator, () => pasteSnippet(b, { getWindow }));
        results.snippets.push({
          id: b.id,
          accelerator: b.accelerator,
          ok,
          error: ok ? undefined : "conflict",
        });
      } catch (e) {
        results.snippets.push({
          id: b.id,
          accelerator: b.accelerator,
          ok: false,
          error: e?.message || "invalid",
        });
      }
    }
    return results;
  }

  function setSnippetBindings(bindings) {
    snippetBindings = Array.isArray(bindings)
      ? bindings
          .filter((b) => b && b.id && b.accelerator)
          .map((b) => ({
            id: String(b.id),
            accelerator: String(b.accelerator),
            content: String(b.content ?? ""),
            title: String(b.title ?? ""),
          }))
      : [];
    return registerAll();
  }

  function setToggleAccelerator(accelerator) {
    const next = String(accelerator || "").trim() || DEFAULT_ACCELERATOR;
    writeSettings({ toggleAccelerator: next });
    return registerAll();
  }

  return { registerAll, setSnippetBindings, setToggleAccelerator };
}

module.exports = { createShortcutManager };
