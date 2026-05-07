// Presentational pieces for ReleaseStatus.

import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { getInstallerKind, type InstallerKind } from "@/lib/mac-asset";
import { formatBytes, formatRelative } from "@/lib/format";
import { GITHUB_RELEASES_URL } from "@/lib/github";

export type ReleaseAsset = {
  name: string;
  size: number;
  browser_download_url: string;
};

export { RecommendedInstaller } from "@/components/RecommendedInstaller";

export function ArchBadge({ label, present }: { label: string; present: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono-tight uppercase tracking-wider border ${
        present
          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
          : "bg-muted text-muted-foreground border-border"
      }`}
      title={present ? `${label} build available` : `${label} build missing`}
    >
      {present ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

const KIND_STYLES: Record<InstallerKind, string> = {
  dmg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400",
  zip: "bg-sky-500/10 text-sky-600 border-sky-500/30 dark:text-sky-400",
  "tar.gz": "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400",
  unknown: "bg-muted text-muted-foreground border-border",
};

export function FormatBadge({ kind }: { kind: InstallerKind }) {
  const label = kind === "unknown" ? "?" : kind.toUpperCase();
  return (
    <span
      className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono-tight uppercase tracking-wider border ${KIND_STYLES[kind]}`}
    >
      {label}
    </span>
  );
}

export function ReleaseHeader({
  title,
  publishedAt,
  refreshing,
  onRefresh,
}: {
  title: string;
  publishedAt: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="flex items-start gap-3 mb-3">
      <div className="flex-1 min-w-0">
        <div className="font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground">
          Latest macOS release
        </div>
        <div className="font-serif-display text-2xl leading-tight mt-1">
          {title}
          {publishedAt && (
            <span className="ml-2 text-xs text-muted-foreground font-sans">
              · {formatRelative(publishedAt)}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh release status"
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Retry
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => window.open(GITHUB_RELEASES_URL, "_blank", "noopener")}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Releases
        </Button>
      </div>
    </header>
  );
}

export function AssetList({ assets }: { assets: ReleaseAsset[] }) {
  return (
    <ul className="divide-y border rounded-lg overflow-hidden mt-4">
      {assets.map((a) => (
        <li
          key={a.name}
          className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <span className="font-mono-tight truncate flex-1" title={a.name}>
            {a.name}
          </span>
          <FormatBadge kind={getInstallerKind(a.name)} />
          <span className="text-xs text-muted-foreground shrink-0">{formatBytes(a.size)}</span>
          <a
            href={a.browser_download_url}
            download={a.name}
            rel="noopener"
            className="text-xs text-primary hover:underline shrink-0"
          >
            Download
          </a>
        </li>
      ))}
    </ul>
  );
}

export function ReleaseError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
      <div>
        <div className="font-medium">Couldn't reach GitHub</div>
        <div className="text-muted-foreground">{message}</div>
      </div>
    </div>
  );
}

export function ReleaseEmpty({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
      <div>
        <div className="font-medium">No release published yet</div>
        <div className="text-muted-foreground">
          {message} Run the “Release (macOS)” workflow on GitHub Actions to publish one.
        </div>
      </div>
    </div>
  );
}

export function NoMacAssetsMessage() {
  return (
    <div className="flex items-start gap-2 text-sm">
      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
      <div>
        <div className="font-medium">No macOS artifacts on this release</div>
        <div className="text-muted-foreground">
          The build job didn't upload any .dmg or .zip files. Re-run the “Release (macOS)”
          workflow and check the build logs.
        </div>
      </div>
    </div>
  );
}
