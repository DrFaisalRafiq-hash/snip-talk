// Right-click menu for the tray icon: open Snip Talk, toggle dictation,
// quick-copy a snippet, quit. The list is rebuilt whenever the bound
// accelerator or snippet list changes.

const { Menu, clipboard } = require("electron");
const { app } = require("electron");

function buildTrayMenu({
  accelerator,
  snippets,
  onOpenWindow,
  onToggleDictation,
  getWindow,
}) {
  const snippetItems =
    snippets.length === 0
      ? [{ label: "No snippets yet", enabled: false }]
      : snippets.slice(0, 20).map((s) => ({
          label: `${(s.title || "Untitled").slice(0, 40)}${s.title && s.title.length > 40 ? "…" : ""}`,
          toolTip: (s.content || "").slice(0, 200),
          click: () => {
            clipboard.writeText(s.content || "");
            const win = getWindow?.();
            if (win && !win.isDestroyed()) {
              win.webContents.send("snippet:pasted", { id: s.id, title: s.title });
            }
          },
        }));

  return Menu.buildFromTemplate([
    { label: "Open Snip Talk", click: onOpenWindow },
    {
      label: `Toggle dictation  (${accelerator})`,
      click: onToggleDictation,
      accelerator,
    },
    { type: "separator" },
    { label: "Snippets — click to copy", enabled: false },
    ...snippetItems,
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
}

module.exports = { buildTrayMenu };
