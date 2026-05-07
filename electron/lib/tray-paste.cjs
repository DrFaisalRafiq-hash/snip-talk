// Paste a snippet into the active app via the clipboard + an osascript
// keystroke (Cmd+V). Requires Accessibility permission on macOS; on failure
// we trigger the system prompt and forward an error message to the renderer
// so the UI can show a fix-it hint.

const { clipboard, systemPreferences } = require("electron");
const { execFile } = require("child_process");

function pasteViaAppleScript({ getWindow }) {
  if (process.platform !== "darwin") return;
  const win = getWindow?.();
  execFile(
    "osascript",
    ["-e", 'tell application "System Events" to keystroke "v" using command down'],
    (err) => {
      if (!err) return;
      console.warn(`[tray] osascript paste failed: ${err.message}`);
      try {
        systemPreferences.isTrustedAccessibilityClient(true);
      } catch (promptErr) {
        console.warn(`[tray] accessibility prompt failed: ${promptErr?.message ?? promptErr}`);
      }
      if (win && !win.isDestroyed()) {
        win.webContents.send(
          "snippet:paste-error",
          "Accessibility permission required to paste. Enable Snip Talk under System Settings → Privacy & Security → Accessibility.",
        );
      }
    },
  );
}

function pasteSnippet(binding, { getWindow }) {
  if (!binding) return;
  clipboard.writeText(binding.content || "");
  // Tiny delay so the active app sees the new clipboard contents.
  setTimeout(() => pasteViaAppleScript({ getWindow }), 60);
  const win = getWindow?.();
  if (win && !win.isDestroyed()) {
    win.webContents.send("snippet:pasted", { id: binding.id, title: binding.title });
  }
}

module.exports = { pasteSnippet };
