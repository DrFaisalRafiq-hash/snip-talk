// Pure helpers for picking the best macOS release asset by filename.
// Extracted so they can be unit-tested without touching the React component.

export type Arch = "arm64" | "x64" | "unknown";
export type InstallerKind = "dmg" | "zip" | "tar.gz" | "unknown";

const INSTALLER_EXT_RE = /\.(dmg|zip|tar\.gz|tgz)$/;

export function getInstallerKind(name: string): InstallerKind {
  const s = (name ?? "").toLowerCase();
  if (s.endsWith(".dmg")) return "dmg";
  if (s.endsWith(".tar.gz") || s.endsWith(".tgz")) return "tar.gz";
  if (s.endsWith(".zip")) return "zip";
  return "unknown";
}

export function isMacAsset(name: string): boolean {
  const s = name.toLowerCase();
  if (!INSTALLER_EXT_RE.test(s)) return false;
  if (/(^|[-_.])(mac|macos|darwin|osx|apple)([-_.]|$)/.test(s)) return true;
  if (/(arm64|aarch64|x64|x86_64|universal|intel)/.test(s) && !/(win|linux|android)/.test(s)) return true;
  return false;
}

export function scoreMacAsset(name: string, preferArch: Arch): number {
  const s = name.toLowerCase();
  if (/\.(sig|sha256|shasums?|json|txt|asc|md5|sha512|pem|asc)$/.test(s)) return -1;
  if (!isMacAsset(s)) return -1;
  let v = 0;
  // Prefer the most "native" installer: DMG > tar.gz > zip
  if (s.endsWith(".dmg")) v += 20;
  else if (s.endsWith(".tar.gz") || s.endsWith(".tgz")) v += 8;
  else if (s.endsWith(".zip")) v += 5;
  const isArm = /(arm64|aarch64|apple[-_.]?silicon)/.test(s);
  const isX64 = /(x64|x86_64|intel)/.test(s);
  const isUniversal = /universal/.test(s);
  if (isUniversal) v += 8;
  if (preferArch === "arm64" && isArm) v += 15;
  if (preferArch === "x64" && isX64) v += 15;
  if (preferArch === "arm64" && isX64 && !isUniversal) v -= 5;
  if (preferArch === "x64" && isArm && !isUniversal) v -= 5;
  return v;
}

export function pickBest<T extends { name: string }>(assets: T[], arch: Arch): T | null {
  const ranked = assets
    .map((a) => ({ a, s: scoreMacAsset(a?.name ?? "", arch) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s);
  return ranked[0]?.a ?? null;
}

export function pickOsFallback<T extends { name: string }>(assets: T[]): T | null {
  const ranked = assets
    .map((a) => {
      const name = (a?.name ?? "").toLowerCase();
      if (!name) return { a, s: -1 };
      if (/\.(sig|asc|pem|sha256|sha512|shasums?|md5|json|txt|yml|yaml|xml)$/.test(name)) return { a, s: -1 };
      if (!INSTALLER_EXT_RE.test(name)) return { a, s: -1 };
      if (/(win|windows|linux|android|ios)/.test(name)) return { a, s: -1 };
      let v = 0;
      if (name.endsWith(".dmg")) v += 20;
      else if (name.endsWith(".tar.gz") || name.endsWith(".tgz")) v += 8;
      else if (name.endsWith(".zip")) v += 5;
      if (/(^|[-_.])(mac|macos|darwin|osx|apple)([-_.]|$)/.test(name)) v += 10;
      return { a, s: v };
    })
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s);
  return ranked[0]?.a ?? null;
}

export type InstallInstructions = {
  kind: InstallerKind;
  label: string;       // e.g. "DMG installer"
  mime: string;        // for blob downloads
  steps: string[];     // ordered, user-facing
  note?: string;       // optional caveat
};

export function getInstallInstructions(name: string): InstallInstructions {
  const kind = getInstallerKind(name);
  switch (kind) {
    case "dmg":
      return {
        kind,
        label: "DMG installer",
        mime: "application/x-apple-diskimage",
        steps: [
          "Open the downloaded .dmg from your Downloads folder.",
          "Drag Snip Talk into the Applications folder.",
          "Eject the disk image, then launch Snip Talk from Launchpad.",
        ],
      };
    case "zip":
      return {
        kind,
        label: "ZIP archive",
        mime: "application/zip",
        steps: [
          "Double-click the .zip in Downloads to unarchive it.",
          "Drag Snip Talk.app into your Applications folder.",
          "Launch Snip Talk from Launchpad or Spotlight.",
        ],
        note: "First launch: right-click → Open if macOS warns about an unidentified developer.",
      };
    case "tar.gz":
      return {
        kind,
        label: "tar.gz archive",
        mime: "application/gzip",
        steps: [
          "Open Terminal and cd into your Downloads folder.",
          "Run: tar -xzf <filename>.tar.gz",
          "Move the extracted Snip Talk.app into /Applications and launch it.",
        ],
        note: "tar.gz isn't the standard macOS format — prefer the .dmg if available.",
      };
    default:
      return {
        kind: "unknown",
        label: "Unknown format",
        mime: "application/octet-stream",
        steps: ["This file isn't a recognized macOS installer. Open the GitHub release page to pick a different artifact."],
      };
  }
}
