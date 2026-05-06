import { useMemo, useState } from "react";
import { formatBuildLabel, getBuildInfo } from "@/lib/buildInfo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Logo } from "@/components/Logo";

type ElectronBridge = {
  showAbout?: () => Promise<unknown>;
};

export function VersionBadge({ className = "" }: { className?: string }) {
  const info = useMemo(() => getBuildInfo(), []);
  const [open, setOpen] = useState(false);
  const label = formatBuildLabel(info);

  const onClick = async () => {
    const bridge = (window as unknown as { sniptalk?: ElectronBridge }).sniptalk;
    if (bridge?.showAbout) {
      try {
        await bridge.showAbout();
        return;
      } catch {
        /* fall through to in-app dialog */
      }
    }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className={`font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors ${className}`}
        title="About Snip Talk"
        aria-label={`About Snip Talk — ${label}`}
      >
        {label}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Logo size={28} />
              <div>
                <DialogTitle className="font-serif-display text-2xl">Snip Talk</DialogTitle>
                <DialogDescription className="font-mono-tight uppercase tracking-widest text-[10px]">
                  Speak it. Save it. Reuse it.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-xs font-mono-tight">
            <dt className="text-muted-foreground uppercase tracking-widest">Version</dt>
            <dd className="text-foreground">{info.version}</dd>
            {info.build && (
              <>
                <dt className="text-muted-foreground uppercase tracking-widest">Build</dt>
                <dd className="text-foreground">{info.build}</dd>
              </>
            )}
            {info.commit && info.commit !== "nogit" && (
              <>
                <dt className="text-muted-foreground uppercase tracking-widest">Commit</dt>
                <dd className="text-foreground">
                  {info.commit}
                  {info.dirty ? " (dirty)" : ""}
                </dd>
              </>
            )}
            {info.stamp && (
              <>
                <dt className="text-muted-foreground uppercase tracking-widest">Stamp</dt>
                <dd className="text-foreground break-all">{info.stamp}</dd>
              </>
            )}
            {info.platform && info.arch && (
              <>
                <dt className="text-muted-foreground uppercase tracking-widest">Platform</dt>
                <dd className="text-foreground">
                  {info.platform}/{info.arch}
                </dd>
              </>
            )}
            {info.builtAt && (
              <>
                <dt className="text-muted-foreground uppercase tracking-widest">Built</dt>
                <dd className="text-foreground">{info.builtAt}</dd>
              </>
            )}
            <dt className="text-muted-foreground uppercase tracking-widest">Source</dt>
            <dd className="text-foreground">{info.source}</dd>
          </dl>

          <p className="text-[10px] text-muted-foreground/70">
            © {new Date().getFullYear()} Snip Talk
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
