import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getBuildInfo } from "@/lib/buildInfo";
import {
  checkForUpdate,
  getSkippedVersion,
  skipVersion,
  type UpdateInfo,
} from "@/lib/updates";

// Re-check at most once every 6 hours per session.
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
// Wait 4s after mount so we don't compete with auth/initial paint.
const INITIAL_DELAY_MS = 4000;

export function UpdateChecker() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let interval: number | undefined;

    const run = async () => {
      const current = getBuildInfo().version;
      const update = await checkForUpdate(current);
      if (cancelled || !update) return;
      if (!update.hasUpdate) return;
      if (getSkippedVersion() === update.latestVersion) return;
      setInfo(update);
    };

    const initial = window.setTimeout(run, INITIAL_DELAY_MS);
    interval = window.setInterval(run, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      if (interval) window.clearInterval(interval);
    };
  }, []);

  if (!info || dismissed) return null;

  const download = async () => {
    setBusy(true);
    try {
      if (info.asset) {
        // Direct asset download for the user's platform.
        window.open(info.asset.url, "_blank", "noopener");
      } else {
        // No matching installer — open the release page.
        window.open(info.htmlUrl, "_blank", "noopener");
      }
      toast.success(`Downloading ${info.tag}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    skipVersion(info.latestVersion);
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-card border rounded-xl shadow-lg p-4 animate-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
            Update available
          </div>
          <div className="font-serif-display text-lg leading-tight">
            Snip Talk {info.tag}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            You're on v{info.currentVersion}
            {info.asset ? ` · ${info.asset.name}` : " · no installer for this platform"}
          </div>
        </div>
        <button
          onClick={skip}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss update"
          title="Skip this version"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={download} disabled={busy} className="flex-1">
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {info.asset ? "Download" : "Open release"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => window.open(info.htmlUrl, "_blank", "noopener")}
        >
          Notes
        </Button>
      </div>
    </div>
  );
}
