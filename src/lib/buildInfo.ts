// Centralized access to the app's version stamp.
//
// In a packaged Electron build, `window.sniptalk.buildInfo` is populated from
// build-info.json (written by scripts/release-mac.sh). In a plain web/dev
// build we fall back to Vite-injected env vars (VITE_APP_*) which the same
// script sets at build time, then to package.json's version as a last resort.
import pkg from "../../package.json";

type BuildInfo = {
  version: string;
  build?: string;
  commit?: string;
  stamp?: string;
  dirty?: boolean;
  arch?: string;
  platform?: string;
  builtAt?: string;
  source: "electron" | "vite-env" | "package";
};

// Note: window.sniptalk is declared in src/hooks/useDeepLink.ts; we just
// read an optional `buildInfo` field via a loose cast to avoid duplicating
// the global declaration here.

export function getBuildInfo(): BuildInfo {
  const fromElectron =
    typeof window !== "undefined"
      ? ((window as unknown as { sniptalk?: { buildInfo?: Partial<BuildInfo> } }).sniptalk
          ?.buildInfo as Partial<BuildInfo> | undefined)
      : undefined;
  if (fromElectron && fromElectron.version) {
    return { ...fromElectron, source: "electron" } as BuildInfo;
  }

  const env = (import.meta as any).env ?? {};
  if (env.VITE_APP_VERSION) {
    return {
      version: env.VITE_APP_VERSION,
      build: env.VITE_APP_BUILD,
      commit: env.VITE_APP_COMMIT,
      stamp: env.VITE_APP_VERSION_STAMP,
      source: "vite-env",
    };
  }

  return { version: (pkg as { version: string }).version, source: "package" };
}

/** Short human label, e.g. "v0.1.0 (147 · a1b2c3d4)" */
export function formatBuildLabel(info = getBuildInfo()): string {
  const parts: string[] = [`v${info.version}`];
  const meta: string[] = [];
  if (info.build) meta.push(info.build);
  if (info.commit && info.commit !== "nogit") meta.push(info.commit);
  if (info.dirty) meta.push("dirty");
  if (meta.length) parts.push(`(${meta.join(" · ")})`);
  return parts.join(" ");
}
