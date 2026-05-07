import { useCallback, useEffect, useState } from "react";
import { GITHUB_API_LATEST_RELEASE, GITHUB_RELEASES_URL } from "@/lib/github";
import { isMacAsset } from "@/lib/mac-asset";
import {
  ArchBadge,
  AssetList,
  NoMacAssetsMessage,
  RecommendedInstaller,
  ReleaseEmpty,
  ReleaseError,
  ReleaseHeader,
  type ReleaseAsset,
} from "@/components/ReleaseStatusView";

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
    const res = await fetch(GITHUB_API_LATEST_RELEASE, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
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
        htmlUrl: data?.html_url ?? GITHUB_RELEASES_URL,
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

  const headerTitle = state.kind === "ok" ? `Snip Talk ${state.release.tag}` : "Snip Talk";
  const publishedAt = state.kind === "ok" ? state.release.publishedAt : null;

  return (
    <section aria-label="macOS release status" className="rounded-xl border bg-card p-5">
      <ReleaseHeader
        title={headerTitle}
        publishedAt={publishedAt}
        refreshing={refreshing}
        onRefresh={refresh}
      />

      {state.kind === "loading" && (
        <p className="text-sm text-muted-foreground">Checking GitHub for the latest build…</p>
      )}
      {state.kind === "error" && <ReleaseError message={state.message} />}
      {state.kind === "empty" && <ReleaseEmpty message={state.message} />}

      {state.kind === "ok" && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-4">
            <ArchBadge label="arm64" present={state.release.hasArm64} />
            <ArchBadge label="x64" present={state.release.hasX64} />
            <ArchBadge label="universal" present={state.release.hasUniversal} />
          </div>

          {state.release.macAssets.length === 0 ? (
            <NoMacAssetsMessage />
          ) : (
            <>
              <RecommendedInstaller assets={state.release.macAssets} />
              <AssetList assets={state.release.macAssets} />
            </>
          )}
        </>
      )}
    </section>
  );
}
