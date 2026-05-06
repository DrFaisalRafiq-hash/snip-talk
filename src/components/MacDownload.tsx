import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Apple, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Configure your GitHub repo here (owner/name). If the API call fails or
// no asset is found, we fall back to the static file in /public.
const GITHUB_REPO = "sniptalk/sniptalk"; // <-- update if your repo slug differs
const STATIC_FALLBACK = "/snip-talk-mac.zip";

type Asset = { name: string; url: string; size?: number; tag?: string };

// Detect Apple Silicon vs Intel as best we can in a browser. Modern Chromium
// exposes high-entropy UA-CH; older browsers fall back to UA string sniffing.
async function detectMacArch(): Promise<"arm64" | "x64" | "unknown"> {
  try {
    const uaData = (navigator as any).userAgentData;
    if (uaData?.getHighEntropyValues) {
      const hi = await uaData.getHighEntropyValues(["architecture", "bitness"]);
      if (hi?.architecture === "arm") return "arm64";
      if (hi?.architecture === "x86" && hi?.bitness === "64") return "x64";
    }
  } catch {
    /* ignore */
  }
  const ua = navigator.userAgent.toLowerCase();
  if (/arm64|aarch64/.test(ua)) return "arm64";
  // Intel Macs report "intel mac os x"; Apple Silicon often spoofs the same
  // string but exposes >8 logical cores rarely on Intel laptops. Default to
  // arm64 on modern macOS as that's the common case on new hardware.
  if (/mac os x/.test(ua)) {
    const cores = navigator.hardwareConcurrency ?? 0;
    return cores >= 8 ? "arm64" : "x64";
  }
  return "unknown";
}

function isMacAsset(name: string): boolean {
  const s = name.toLowerCase();
  if (!/\.(dmg|zip)$/.test(s)) return false;
  // Match macOS-ish tokens but exclude things like "extension.zip" / "win.zip".
  if (/(^|[-_.])(mac|macos|darwin|osx|apple)([-_.]|$)/.test(s)) return true;
  // Some builds only include the arch token.
  if (/(arm64|aarch64|x64|x86_64|universal|intel)/.test(s) && !/(win|linux|android)/.test(s)) return true;
  return false;
}

function scoreMacAsset(name: string, preferArch: "arm64" | "x64" | "unknown"): number {
  const s = name.toLowerCase();
  if (!isMacAsset(s)) return -1;
  let v = 0;
  // Installer over zipped .app
  if (s.endsWith(".dmg")) v += 20;
  if (s.endsWith(".zip")) v += 5;
  // Arch match
  const isArm = /(arm64|aarch64|apple[-_.]?silicon)/.test(s);
  const isX64 = /(x64|x86_64|intel)/.test(s);
  const isUniversal = /universal/.test(s);
  if (isUniversal) v += 8;
  if (preferArch === "arm64" && isArm) v += 15;
  if (preferArch === "x64" && isX64) v += 15;
  // Mild penalty for the wrong arch when we know what we want
  if (preferArch === "arm64" && isX64 && !isUniversal) v -= 5;
  if (preferArch === "x64" && isArm && !isUniversal) v -= 5;
  // Skip detached signatures, checksums, manifests
  if (/\.(sig|sha256|shasums?|json|txt|asc)$/.test(s)) return -1;
  return v;
}

async function fetchLatestMacAsset(): Promise<Asset | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const assets: any[] = Array.isArray(data?.assets) ? data.assets : [];
    if (assets.length === 0) return null;
    const arch = await detectMacArch();
    const ranked = assets
      .map((a) => ({ a, s: scoreMacAsset(a.name ?? "", arch) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s);
    const best = ranked[0];
    if (!best) return null;
    return {
      name: best.a.name,
      url: best.a.browser_download_url,
      size: best.a.size,
      tag: data.tag_name,
    };
  } catch {
    return null;
  }
}

async function fetchStaticFallback(): Promise<Asset | null> {
  try {
    const res = await fetch(STATIC_FALLBACK, { method: "HEAD" });
    if (!res.ok) return null;
    return { name: "snip-talk-mac.zip", url: STATIC_FALLBACK };
  } catch {
    return null;
  }
}

export function MacDownload() {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const a = (await fetchLatestMacAsset()) ?? (await fetchStaticFallback());
      if (!cancelled) {
        setAsset(a);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const download = async () => {
    if (!asset) {
      const releasesUrl = `https://github.com/${GITHUB_REPO}/releases`;
      window.open(releasesUrl, "_blank", "noopener");
      toast.message("No macOS installer detected", {
        description:
          "We couldn't find a matching .dmg or .zip on the latest release. Opening the GitHub releases page so you can pick a build manually.",
        action: {
          label: "Open releases",
          onClick: () => window.open(releasesUrl, "_blank", "noopener"),
        },
        duration: 8000,
      });
      return;
    }
    setBusy(true);
    try {
      if (asset.url.startsWith("http")) {
        window.open(asset.url, "_blank", "noopener");
        toast.success(`Downloading ${asset.name}${asset.tag ? ` (${asset.tag})` : ""}`);
      } else {
        const res = await fetch(asset.url);
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = asset.name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed", {
        description: "You can still grab a build manually from GitHub releases.",
        action: {
          label: "Open releases",
          onClick: () =>
            window.open(`https://github.com/${GITHUB_REPO}/releases`, "_blank", "noopener"),
        },
      });
    } finally {
      setBusy(false);
    }
  };

  const tooltip = loading
    ? "Checking for the latest macOS build…"
    : asset
    ? `Download ${asset.name}${asset.tag ? ` (${asset.tag})` : ""}`
    : "No macOS installer found — click to open GitHub releases";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={download}
      disabled={busy}
      title={tooltip}
      aria-label={tooltip}
      className="relative"
    >
      {busy || loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Apple className="h-4 w-4" />}
      {!loading && !asset && (
        <span
          className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive"
          aria-hidden="true"
        />
      )}
    </Button>
  );
}
