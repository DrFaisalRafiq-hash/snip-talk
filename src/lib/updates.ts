// Lightweight GitHub-release update checker.
//
// Polls the public Releases API, compares the latest tag to the running
// build's version, and picks the best installer asset for the current
// platform/arch. No backend required; no auth needed for public repos.

import {
  GITHUB_API_LATEST_RELEASE,
  GITHUB_RELEASES_LATEST_URL,
} from "@/lib/github";
import { pickPlatformAsset } from "@/lib/mac-asset";
import { detectArch, detectPlatform } from "@/lib/platform";

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

type GithubAsset = {
  name: string;
  browser_download_url: string;
  size?: number;
  content_type?: string;
};

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
    const res = await fetch(GITHUB_API_LATEST_RELEASE, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) {
      console.warn(`[updates] GitHub releases API returned ${res.status}`);
      return null;
    }
    const data = await res.json();
    const tag: string = data?.tag_name ?? "";
    if (!tag) return null;
    const latestVersion = normalize(tag);
    const platform = detectPlatform();
    const arch = detectArch();
    const rawAssets: GithubAsset[] = Array.isArray(data?.assets) ? data.assets : [];
    const picked = pickPlatformAsset(rawAssets, platform, arch);
    const asset: UpdateAsset | null = picked
      ? {
          name: picked.name,
          url: picked.browser_download_url,
          size: picked.size,
          contentType: picked.content_type,
        }
      : null;
    return {
      currentVersion: normalize(currentVersion),
      latestVersion,
      hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
      tag,
      htmlUrl: data?.html_url ?? GITHUB_RELEASES_LATEST_URL,
      publishedAt: data?.published_at,
      notes: data?.body,
      asset,
    };
  } catch (e) {
    console.warn("[updates] checkForUpdate failed", e);
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
