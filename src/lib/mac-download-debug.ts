// Optional debug logging for the Mac auto-download picker. Enable with
// `?debug-download=1` in the URL or `localStorage.setItem('debug-download','1')`.
// Logs the full asset ranking table so you can see why a particular file was
// (or was not) chosen. No-ops when disabled.

import { scoreMacAsset, type Arch } from "@/lib/mac-asset";

type RawAsset = { name: string; size?: number };

export function isDebugEnabled(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const url = new URL(window.location.href);
    if (url.searchParams.get("debug-download") === "1") return true;
    return window.localStorage?.getItem("debug-download") === "1";
  } catch {
    return false;
  }
}

export function explainScore(name: string, arch: Arch): string {
  const s = (name ?? "").toLowerCase();
  const reasons: string[] = [];
  if (/\.(sig|sha256|shasums?|json|txt|asc|md5|sha512|pem)$/.test(s)) reasons.push("sidecar/checksum → -1");
  if (!/\.(dmg|zip|tar\.gz|tgz)$/.test(s)) reasons.push("not an installer");
  if (s.endsWith(".dmg")) reasons.push("+20 dmg");
  if (s.endsWith(".zip")) reasons.push("+5 zip");
  if (/(^|[-_.])(mac|macos|darwin|osx|apple)([-_.]|$)/.test(s)) reasons.push("mac token");
  if (/universal/.test(s)) reasons.push("+8 universal");
  const isArm = /(arm64|aarch64|apple[-_.]?silicon)/.test(s);
  const isX64 = /(x64|x86_64|intel)/.test(s);
  if (arch === "arm64" && isArm) reasons.push("+15 arm64 match");
  if (arch === "x64" && isX64) reasons.push("+15 x64 match");
  if (arch === "arm64" && isX64 && !/universal/.test(s)) reasons.push("-5 wrong arch (x64)");
  if (arch === "x64" && isArm && !/universal/.test(s)) reasons.push("-5 wrong arch (arm)");
  if (/(win|windows|linux|android|ios)/.test(s)) reasons.push("other-OS token");
  return reasons.join(", ") || "no signals";
}

export function logRanking(assets: RawAsset[], arch: Arch): void {
  const table = assets.map((a) => ({
    name: a?.name,
    size: a?.size,
    score: scoreMacAsset(a?.name ?? "", arch),
    reasons: explainScore(a?.name ?? "", arch),
  }));
  table.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  console.groupCollapsed(`[MacDownload] asset ranking (arch=${arch})`);
  console.table(table);
  console.groupEnd();
}
