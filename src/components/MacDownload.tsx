import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Apple, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GITHUB_API_LATEST_RELEASE, GITHUB_RELEASES_URL } from "@/lib/github";
import {
  pickBest,
  pickOsFallback,
  scoreMacAsset,
  type Arch,
} from "@/lib/mac-asset";
import { detectArchHighEntropy } from "@/lib/platform";

const STATIC_FALLBACK = "/snip-talk-mac.zip";

type Asset = { name: string; url: string; size?: number; tag?: string };
type RawAsset = { name: string; browser_download_url: string; size?: number };

// Debug mode: enable with `?debug-download=1` in URL or
// `localStorage.setItem('debug-download', '1')`. Logs the full ranking table
// of every release asset so you can see why a particular file was chosen.
function isDebugEnabled(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const url = new URL(window.location.href);
    if (url.searchParams.get("debug-download") === "1") return true;
    return window.localStorage?.getItem("debug-download") === "1";
  } catch {
    return false;
  }
}

function explainScore(name: string, arch: Arch): string {
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

    if (debug) {
      const table = assets.map((a) => ({
        name: a?.name,
        size: a?.size,
        score: scoreMacAsset(a?.name ?? "", arch),
        reasons: explainScore(a?.name ?? "", arch),
      }));
      // Sort highest-first for easier scanning.
      table.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
      console.groupCollapsed(`[MacDownload] asset ranking (arch=${arch})`);
      console.table(table);
      console.groupEnd();
    }

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

  const validateAsset = (a: Asset): { ok: true } | { ok: false; reason: string } => {
    const name = (a.name ?? "").toLowerCase();
    if (!name) return { ok: false, reason: "Asset has no filename." };
    if (/\.(sig|asc|pem|sha256|sha512|shasums?|md5|json|txt|yml|yaml|xml)$/.test(name)) {
      return { ok: false, reason: `${a.name} is a signature/checksum file, not an installer.` };
    }
    if (!/\.(dmg|zip)$/.test(name)) {
      return { ok: false, reason: `${a.name} isn't a .dmg or .zip installer.` };
    }
    if (typeof a.size === "number") {
      const MIN = 1 * 1024 * 1024;
      const MAX = 2 * 1024 * 1024 * 1024;
      if (a.size < MIN) return { ok: false, reason: `${a.name} looks too small (${a.size} bytes).` };
      if (a.size > MAX) return { ok: false, reason: `${a.name} looks too large (${a.size} bytes).` };
    }
    return { ok: true };
  };

  const openReleasesPage = () => {
    window.open(GITHUB_RELEASES_URL, "_blank", "noopener");
  };

  // Stream the asset into a Blob so we can trigger the browser's download
  // pipeline with a real filename + correct MIME type. macOS Safari/Chrome
  // will then offer "Open with DiskImageMounter" (.dmg) or auto-unzip (.zip),
  // which is the closest a web page can get to "launching" an installer.
  const downloadAsBlob = async (a: Asset): Promise<boolean> => {
    try {
      const res = await fetch(a.url, { mode: "cors", credentials: "omit" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const mime = a.name.toLowerCase().endsWith(".dmg")
        ? "application/x-apple-diskimage"
        : "application/zip";
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = a.name;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      return true;
    } catch {
      return false;
    }
  };

  // Anchor-click fallback: relies on GitHub's `Content-Disposition: attachment`
  // header. Works even when CORS blocks the fetch above.
  const downloadViaAnchor = (a: Asset) => {
    const link = document.createElement("a");
    link.href = a.url;
    link.download = a.name;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

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

      const check = validateAsset(fresh);
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
