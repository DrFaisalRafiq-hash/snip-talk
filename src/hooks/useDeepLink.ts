import { useEffect } from "react";

/**
 * Listens for sniptalk:// deep links delivered from the Electron main
 * process (or from in-page <a href="sniptalk://..."> clicks during dev).
 *
 * URL grammar:
 *   sniptalk://dictate                 -> focus dictation
 *   sniptalk://snippets                -> focus snippets
 *   sniptalk://dictate?text=hello      -> focus dictation with prefill
 */
export type DeepLink = {
  raw: string;
  target: "dictate" | "snippets" | "unknown";
  params: URLSearchParams;
};

function parse(url: string): DeepLink | null {
  if (!url || !url.startsWith("sniptalk://")) return null;
  try {
    // URL parser doesn't love custom schemes — normalize to https for parsing.
    const u = new URL(url.replace(/^sniptalk:\/\//, "https://_/"));
    const seg = u.pathname.replace(/^\/+/, "").split("/")[0]?.toLowerCase();
    const target: DeepLink["target"] =
      seg === "dictate" || seg === "snippets" ? seg : "unknown";
    return { raw: url, target, params: u.searchParams };
  } catch {
    return null;
  }
}

declare global {
  interface Window {
    sniptalk?: {
      onDeepLink: (cb: (url: string) => void) => () => void;
      getInitialDeepLink: () => Promise<string | null>;
      isElectron: boolean;
    };
  }
}

export function useDeepLink(handler: (link: DeepLink) => void) {
  useEffect(() => {
    let unsub: (() => void) | undefined;

    if (window.sniptalk) {
      // Cold-start URL
      window.sniptalk.getInitialDeepLink().then((url) => {
        const link = url ? parse(url) : null;
        if (link) handler(link);
      });
      // Live URLs
      unsub = window.sniptalk.onDeepLink((url) => {
        const link = parse(url);
        if (link) handler(link);
      });
    }

    // Browser fallback: ?deeplink=sniptalk%3A%2F%2Fdictate (handy for testing)
    const fromQuery = new URLSearchParams(window.location.search).get("deeplink");
    if (fromQuery) {
      const link = parse(fromQuery);
      if (link) handler(link);
    }

    return () => {
      unsub?.();
    };
  }, [handler]);
}
