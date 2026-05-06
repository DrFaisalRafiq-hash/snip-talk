// Pure helpers for picking the best macOS release asset by filename.
// Extracted so they can be unit-tested without touching the React component.

export type Arch = "arm64" | "x64" | "unknown";

export function isMacAsset(name: string): boolean {
  const s = name.toLowerCase();
  if (!/\.(dmg|zip)$/.test(s)) return false;
  if (/(^|[-_.])(mac|macos|darwin|osx|apple)([-_.]|$)/.test(s)) return true;
  if (/(arm64|aarch64|x64|x86_64|universal|intel)/.test(s) && !/(win|linux|android)/.test(s)) return true;
  return false;
}

export function scoreMacAsset(name: string, preferArch: Arch): number {
  const s = name.toLowerCase();
  if (/\.(sig|sha256|shasums?|json|txt|asc|md5|sha512|pem|asc)$/.test(s)) return -1;
  if (!isMacAsset(s)) return -1;
  let v = 0;
  if (s.endsWith(".dmg")) v += 20;
  if (s.endsWith(".zip")) v += 5;
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
      if (!/\.(dmg|zip)$/.test(name)) return { a, s: -1 };
      if (/(win|windows|linux|android|ios)/.test(name)) return { a, s: -1 };
      let v = 0;
      if (name.endsWith(".dmg")) v += 20;
      if (name.endsWith(".zip")) v += 5;
      if (/(^|[-_.])(mac|macos|darwin|osx|apple)([-_.]|$)/.test(name)) v += 10;
      return { a, s: v };
    })
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s);
  return ranked[0]?.a ?? null;
}
