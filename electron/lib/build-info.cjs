// Read build-info.json (written by scripts/lib/version-stamp.sh).
// Falls back to {} during dev. Shared by main and preload so both see the
// same stamp + commit + version triplet.
const fs = require("fs");
const path = require("path");

function loadBuildInfo() {
  const candidates = [
    path.join(process.resourcesPath || "", "build-info.json"),
    path.join(__dirname, "..", "..", "build", "build-info.json"),
  ];
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch {
      /* keep trying the next candidate */
    }
  }
  return {};
}

function deriveVersionStamp(info, fallbackVersion) {
  if (info.stamp) return info.stamp;
  if (info.build && info.commit) return `${fallbackVersion}+${info.build}.${info.commit}`;
  return `v${fallbackVersion}`;
}

function deriveShortCommit(info) {
  return info.commit && info.commit !== "nogit" ? info.commit : "";
}

// Wire the native About panel (macOS) — other platforms get a fallback dialog.
// Returns nothing; call once on startup with the loaded build info.
function configureAboutPanel(app, info, appVersion, versionStamp) {
  if (typeof app.setAboutPanelOptions !== "function") return;
  const shortCommit = deriveShortCommit(info);
  app.setAboutPanelOptions({
    applicationName: "Snip Talk",
    applicationVersion: appVersion,
    version: info.build || "",
    copyright: `© ${new Date().getFullYear()} Snip Talk`,
    credits: [
      `Build ${info.build || "dev"}`,
      shortCommit ? `Commit ${shortCommit}${info.dirty ? " (dirty)" : ""}` : "",
      info.builtAt ? `Built ${info.builtAt}` : "",
      info.platform && info.arch ? `${info.platform}/${info.arch}` : "",
      `Stamp ${versionStamp}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

module.exports = {
  loadBuildInfo,
  deriveVersionStamp,
  deriveShortCommit,
  configureAboutPanel,
};
