import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Apple, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GITHUB_API_LATEST_RELEASE, GITHUB_RELEASES_URL } from "@/lib/github";
import { pickBest, pickOsFallback } from "@/lib/mac-asset";
import { detectArchHighEntropy } from "@/lib/platform";
import {
  downloadAsBlob,
  downloadViaAnchor,
  validateInstaller,
  type DownloadAsset,
} from "@/lib/download";
import { isDebugEnabled, logRanking } from "@/lib/mac-download-debug";

const STATIC_FALLBACK = "/snip-talk-mac.zip";

type Asset = DownloadAsset & { tag?: string };
type RawAsset = { name: string; browser_download_url: string; size?: number };

async function fetchLatestMacAsset(): Promise<Asset | null> {
  const debug = isDebugEnabled();
  try {
    if (debug) console.log("[MacDownload] fetching", GITHUB_API_LATEST_RELEASE);
    const res = await fetch(GITHUB_API_LATEST_RELEASE, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) {
      if (debug) console.warn("[MacDownload] release fetch failed", res.status, res.statusText);
      return null;
    }
    const data = await res.json();
    const assets: RawAsset[] = Array.isArray(data?.assets) ? data.assets : [];
    if (debug) console.log(`[MacDownload] release ${data?.tag_name} has ${assets.length} assets`);
    if (assets.length === 0) return null;
    const arch = await detectArchHighEntropy();
    if (debug) console.log("[MacDownload] detected arch:", arch);
    if (debug) logRanking(assets, arch);

    const archMatch = pickBest(assets, arch);
    const best = archMatch ?? pickOsFallback(assets);
    if (debug) {
      if (archMatch) console.log("[MacDownload] arch-aware pick:", archMatch.name);
      else if (best) console.log("[MacDownload] OS-fallback pick:", best.name);
      else console.warn("[MacDownload] no asset matched");
    }
    if (!best) return null;
    return {
      name: best.name,
      url: best.browser_download_url,
      size: best.size,
      tag: data.tag_name,
    };
  } catch (e) {
    if (debug) console.error("[MacDownload] fetch error", e);
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

const openReleasesPage = () => window.open(GITHUB_RELEASES_URL, "_blank", "noopener");

export function MacDownload() {
  // We still prefetch on mount so the tooltip can show the resolved filename,
  // but the click handler ALWAYS re-fetches to guarantee the user gets the
  // newest release (CI may have published a new build since page load).
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
    setBusy(true);
    try {
      // ALWAYS re-resolve the latest release at click time so we never serve a
      // stale asset that was current when the page first loaded.
      const fresh = (await fetchLatestMacAsset()) ?? asset ?? (await fetchStaticFallback());

      if (!fresh) {
        openReleasesPage();
        toast.message("No macOS installer detected", {
          description:
            "We couldn't find a matching .dmg or .zip on the latest release. Opening the GitHub releases page so you can pick a build manually.",
          action: { label: "Open releases", onClick: openReleasesPage },
          duration: 8000,
        });
        return;
      }

      setAsset(fresh);

      const check = validateInstaller(fresh);
      if (check.ok === false) {
        toast.error("Installer failed validation", {
          description: `${check.reason} Opening releases so you can pick a build manually.`,
          action: { label: "Open releases", onClick: openReleasesPage },
          duration: 8000,
        });
        return;
      }

      const isDmg = fresh.name.toLowerCase().endsWith(".dmg");
      const ok = (await downloadAsBlob(fresh)) || (downloadViaAnchor(fresh), true);

      if (ok) {
        toast.success(`Downloading ${fresh.name}${fresh.tag ? ` (${fresh.tag})` : ""}`, {
          description: isDmg
            ? "When it finishes, open the .dmg from Downloads and drag Snip Talk into Applications."
            : "When it finishes, unzip it and drag Snip Talk.app into Applications.",
          duration: 9000,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed", {
        description: "You can still grab a build manually from GitHub releases.",
        action: { label: "Open releases", onClick: openReleasesPage },
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
