import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, AlertCircle, ExternalLink, Loader2, Download, Package } from "lucide-react";
import {
  isMacAsset,
  pickBest,
  pickOsFallback,
  getInstallerKind,
  getInstallInstructions,
  type Arch,
  type InstallerKind,
} from "@/lib/mac-asset";

const GITHUB_REPO = "DrFaisalRafiq-hash/snip-talk";

type ReleaseAsset = {
  name: string;
  size: number;
  browser_download_url: string;
};

type ReleaseInfo = {
  tag: string;
  htmlUrl: string;
  publishedAt: string | null;
  macAssets: ReleaseAsset[];
  hasArm64: boolean;
  hasX64: boolean;
  hasUniversal: boolean;
};

type State =
  | { kind: "loading" }
  | { kind: "ok"; release: ReleaseInfo }
  | { kind: "empty"; message: string }
  | { kind: "error"; message: string };

function classifyArch(name: string): { arm64: boolean; x64: boolean; universal: boolean } {
  const s = name.toLowerCase();
  return {
    arm64: /(arm64|aarch64|apple[-_.]?silicon)/.test(s),
    x64: /(x64|x86_64|intel)/.test(s),
    universal: /universal/.test(s),
  };
}

async function fetchLatestRelease(): Promise<State> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" }
    );
    if (res.status === 404) {
      return { kind: "empty", message: "No published release yet." };
    }
    if (!res.ok) {
      return { kind: "error", message: `GitHub API responded ${res.status}` };
    }
    const data = await res.json();
    const allAssets: ReleaseAsset[] = Array.isArray(data?.assets) ? data.assets : [];
    const macAssets = allAssets.filter((a) => isMacAsset(a?.name ?? ""));
    let hasArm64 = false;
    let hasX64 = false;
    let hasUniversal = false;
    for (const a of macAssets) {
      const c = classifyArch(a.name);
      if (c.arm64) hasArm64 = true;
      if (c.x64) hasX64 = true;
      if (c.universal) hasUniversal = true;
    }
    return {
      kind: "ok",
      release: {
        tag: data?.tag_name ?? "unknown",
        htmlUrl: data?.html_url ?? `https://github.com/${GITHUB_REPO}/releases`,
        publishedAt: data?.published_at ?? null,
        macAssets,
        hasArm64,
        hasX64,
        hasUniversal,
      },
    };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "Network error" };
  }
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function ArchBadge({ label, present }: { label: string; present: boolean }) {
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

export function ReleaseStatus() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const next = await fetchLatestRelease();
    setState(next);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const releasesUrl = `https://github.com/${GITHUB_REPO}/releases`;

  return (
    <section
      aria-label="macOS release status"
      className="rounded-xl border bg-card p-5"
    >
      <header className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground">
            Latest macOS release
          </div>
          <div className="font-serif-display text-2xl leading-tight mt-1">
            {state.kind === "ok" ? `Snip Talk ${state.release.tag}` : "Snip Talk"}
            {state.kind === "ok" && state.release.publishedAt && (
              <span className="ml-2 text-xs text-muted-foreground font-sans">
                · {formatRelative(state.release.publishedAt)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={refresh}
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
            onClick={() => window.open(releasesUrl, "_blank", "noopener")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Releases
          </Button>
        </div>
      </header>

      {state.kind === "loading" && (
        <p className="text-sm text-muted-foreground">Checking GitHub for the latest build…</p>
      )}

      {state.kind === "error" && (
        <div className="flex items-start gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Couldn't reach GitHub</div>
            <div className="text-muted-foreground">{state.message}</div>
          </div>
        </div>
      )}

      {state.kind === "empty" && (
        <div className="flex items-start gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">No release published yet</div>
            <div className="text-muted-foreground">
              {state.message} Run the “Release (macOS)” workflow on GitHub Actions to publish one.
            </div>
          </div>
        </div>
      )}

      {state.kind === "ok" && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-4">
            <ArchBadge label="arm64" present={state.release.hasArm64} />
            <ArchBadge label="x64" present={state.release.hasX64} />
            <ArchBadge label="universal" present={state.release.hasUniversal} />
          </div>

          {state.release.macAssets.length === 0 ? (
            <div className="flex items-start gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">No macOS artifacts on this release</div>
                <div className="text-muted-foreground">
                  The build job didn't upload any .dmg or .zip files. Re-run the “Release
                  (macOS)” workflow and check the build logs.
                </div>
              </div>
            </div>
          ) : (
            <ul className="divide-y border rounded-lg overflow-hidden">
              {state.release.macAssets.map((a) => (
                <li
                  key={a.name}
                  className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span className="font-mono-tight truncate flex-1" title={a.name}>
                    {a.name}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatBytes(a.size)}
                  </span>
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
          )}
        </>
      )}
    </section>
  );
}
