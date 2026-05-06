import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Apple, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Configure your GitHub repo here (owner/name). If the API call fails or
// no asset is found, we fall back to the static file in /public.
const GITHUB_REPO = "sniptalk/sniptalk"; // <-- update if your repo slug differs
const STATIC_FALLBACK = "/snip-talk-mac.zip";

type Asset = { name: string; url: string; size?: number; tag?: string };

async function fetchLatestMacAsset(): Promise<Asset | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const assets: any[] = data?.assets ?? [];
    // Prefer DMG (arm64 first), then ZIP
    const score = (n: string) => {
      const s = n.toLowerCase();
      if (!/\.(dmg|zip)$/.test(s)) return -1;
      if (!/(mac|darwin|osx)/.test(s)) return -1;
      let v = 0;
      if (s.endsWith(".dmg")) v += 10;
      if (/arm64|aarch64|apple/.test(s)) v += 3;
      if (/x64|x86_64|intel/.test(s)) v += 1;
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
      // Fall back to the GitHub releases page so the user can grab whatever
      // build is available (or see that none has been published yet).
      window.open(`https://github.com/${GITHUB_REPO}/releases`, "_blank", "noopener");
      toast.message("Opening GitHub releases page");
      return;
    }
    setBusy(true);
    try {
      // For GitHub assets, opening in a new tab triggers download with proper headers.
      // For the static fallback, fetch+blob avoids preview auth issues.
      if (asset.url.startsWith("http")) {
        window.open(asset.url, "_blank", "noopener");
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
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={download}
      disabled={busy}
      title={asset ? `Download Snip Talk for macOS${asset.tag ? ` (${asset.tag})` : ""}` : "Download for macOS"}
      aria-label="Download for macOS"
    >
      {busy || loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Apple className="h-4 w-4" />}
    </Button>
  );
}
