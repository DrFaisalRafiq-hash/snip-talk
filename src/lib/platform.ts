// Browser-side platform / CPU-arch detection for picking the right release
// asset. Best-effort only — use the high-entropy UA-CH fields when the browser
// exposes them, and fall back to UA string sniffing.

import type { Arch } from "@/lib/mac-asset";

export type Platform = "mac" | "win" | "linux" | "other";

type UAData = {
  platform?: string;
  architecture?: string;
  bitness?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<{
    architecture?: string;
    bitness?: string;
    platform?: string;
  }>;
};

function getUAData(): UAData | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as unknown as { userAgentData?: UAData }).userAgentData ?? null;
}

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  if (/mac|darwin/.test(ua)) return "mac";
  if (/windows|win32|win64/.test(ua)) return "win";
  if (/linux/.test(ua)) return "linux";
  return "other";
}

// Quick synchronous arch hint. Prefers UA-CH `architecture` when present,
// otherwise sniffs the UA string. Returns "unknown" when nothing is conclusive.
export function detectArch(): Arch {
  if (typeof navigator === "undefined") return "unknown";
  const uaData = getUAData();
  if (uaData?.architecture === "arm") return "arm64";
  if (uaData?.architecture === "x86") return "x64";
  const ua = navigator.userAgent.toLowerCase();
  if (/arm64|aarch64/.test(ua)) return "arm64";
  if (/x86_64|wow64|win64|x64/.test(ua)) return "x64";
  return "unknown";
}

// Async variant that consults the high-entropy UA-CH fields. Use this when you
// can wait for a Promise; otherwise `detectArch()` is the right call.
export async function detectArchHighEntropy(): Promise<Arch> {
  const uaData = getUAData();
  if (uaData?.getHighEntropyValues) {
    try {
      const hi = await uaData.getHighEntropyValues(["architecture", "bitness"]);
      if (hi?.architecture === "arm") return "arm64";
      if (hi?.architecture === "x86" && hi?.bitness === "64") return "x64";
    } catch {
      /* fall through to UA sniff */
    }
  }
  return detectArch();
}
