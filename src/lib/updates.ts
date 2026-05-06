// Lightweight GitHub-release update checker.
//
// Polls the public Releases API, compares the latest tag to the running
// build's version, and picks the best installer asset for the current
// platform/arch. No backend required; no auth needed for public repos.

const GITHUB_REPO = "sniptalk/sniptalk"; // keep in sync with MacDownload.tsx
const RELEASES_LATEST = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const RELEASES_HTML = `https://github.com/${GITHUB_REPO}/releases/latest`;

export type UpdateAsset = {
  name: string;
  url: string;
  size?: number;
  contentType?: string;
};

export type UpdateInfo = {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  tag: string;
  htmlUrl: string;
  publishedAt?: string;
  notes?: string;
  asset: UpdateAsset | null; // best installer for current platform, if any
};

type Platform = "mac" | "win" | "linux" | "other";
type Arch = "arm64" | "x64" | "unknown";

function detectPlatform(): { platform: Platform; arch: Arch } {
  if (typeof navigator === "undefined") return { platform: "other", arch: "unknown" };
  const ua = navigator.userAgent.toLowerCase();
  const platform: Platform = /mac|darwin/.test(ua)
    ? "mac"
    : /win/.test(ua)
    ? "win"
    : /linux/.test(ua)
    ? "linux"
    : "other";
  // Best-effort arch sniff (not always exposed). Treat Apple Silicon Macs
  // and modern ARM Windows as arm64; everything else defaults to x64.
  const arch: Arch =
    /arm64|aarch64/.test(ua) || (platform === "mac" && (navigator as any).userAgentData?.platform === "macOS" && (navigator as any).userAgentData?.architecture === "arm")
      ? "arm64"
      : "x64";
  return { platform, arch };
}

function pickAsset(assets: any[], platform: Platform, arch: Arch): UpdateAsset | null {
  const score = (name: string): number => {
    const s = name.toLowerCase();
    let v = -1;
    if (platform === "mac") {
      if (!/(mac|darwin|osx)/.test(s)) return -1;
      if (/\.(dmg|zip)$/.test(s)) v = 0;
      if (s.endsWith(".dmg")) v += 10;
      if (arch === "arm64" && /(arm64|aarch64|apple|universal)/.test(s)) v += 5;
      if (arch === "x64" && /(x64|x86_64|intel|universal)/.test(s)) v += 5;
    } else if (platform === "win") {
      if (!/\.(exe|msi|zip)$/.test(s)) return -1;
      if (!/(win|windows)/.test(s)) return -1;
      v = s.endsWith(".exe") ? 10 : s.endsWith(".msi") ? 8 : 1;
      if (arch === "arm64" && /arm64/.test(s)) v += 5;
      if (arch === "x64" && /(x64|x86_64)/.test(s)) v += 5;
    } else if (platform === "linux") {
      if (!/\.(appimage|deb|rpm|tar\.gz|tgz)$/.test(s)) return -1;
      v = s.endsWith(".appimage") ? 10 : 5;
      if (arch === "arm64" && /(arm64|aarch64)/.test(s)) v += 5;
      if (arch === "x64" && /(x64|x86_64|amd64)/.test(s)) v += 5;
    }
    return v;
  };
  const best = assets
    .map((a) => ({ a, s: score(a.name) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)[0];
  if (!best) return null;
  return {
    name: best.a.name,
    url: best.a.browser_download_url,
    size: best.a.size,
    contentType: best.a.content_type,
  };
}

// Strip leading "v" and anything after "+" so "v1.2.3+abc" -> "1.2.3".
function normalize(v: string): string {
  return v.replace(/^v/i, "").split("+")[0].trim();
}

// Compare semver-ish strings; returns >0 if a>b, <0 if a<b, 0 if equal.
// Handles pre-release tags loosely (alpha < beta < rc < release).
export function compareVersions(a: string, b: string): number {
  const [aMain, aPre = ""] = normalize(a).split("-", 2);
  const [bMain, bPre = ""] = normalize(b).split("-", 2);
  const ap = aMain.split(".").map((x) => parseInt(x, 10) || 0);
  const bp = bMain.split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    const d = (ap[i] ?? 0) - (bp[i] ?? 0);
    if (d) return d;
  }
  // No pre-release ranks higher than a pre-release of the same main.
  if (!aPre && bPre) return 1;
  if (aPre && !bPre) return -1;
  return aPre.localeCompare(bPre);
}

export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(RELEASES_LATEST, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const tag: string = data?.tag_name ?? "";
    if (!tag) return null;
    const latestVersion = normalize(tag);
    const { platform, arch } = detectPlatform();
    const asset = Array.isArray(data.assets) ? pickAsset(data.assets, platform, arch) : null;
    return {
      currentVersion: normalize(currentVersion),
      latestVersion,
      hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
      tag,
      htmlUrl: data?.html_url ?? RELEASES_HTML,
      publishedAt: data?.published_at,
      notes: data?.body,
      asset,
    };
  } catch {
    return null;
  }
}

// Persist "user dismissed this version" so we don't nag every load.
const SKIP_KEY = "sniptalk:skipUpdateVersion";
export function getSkippedVersion(): string | null {
  try {
    return localStorage.getItem(SKIP_KEY);
  } catch {
    return null;
  }
}
export function skipVersion(v: string) {
  try {
    localStorage.setItem(SKIP_KEY, normalize(v));
  } catch {
    /* ignore */
  }
}
