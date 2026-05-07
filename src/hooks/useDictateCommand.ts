// Translate sniptalk:// deep links into Dictation prefills + commands and
// keep the tab state in sync. Strips the one-shot ?deeplink= query param
// after consumption so reloads don't re-fire commands like mode=live.

import { useCallback, useEffect, useRef, useState } from "react";
import { useDeepLink } from "@/hooks/useDeepLink";
import type { DictationCommand } from "@/components/Dictation";

export type AppTab = "dictate" | "snippets" | "history";

const VALID_MODES = ["live", "stop", "toggle", "pause", "resume"] as const;
const VALID_ACTIONS = ["copy", "clear"] as const;

type Mode = (typeof VALID_MODES)[number];
type Action = (typeof VALID_ACTIONS)[number];

function parseMode(raw: string | null | undefined): Mode | undefined {
  return raw && (VALID_MODES as readonly string[]).includes(raw) ? (raw as Mode) : undefined;
}
function parseAction(raw: string | null | undefined): Action | undefined {
  return raw && (VALID_ACTIONS as readonly string[]).includes(raw) ? (raw as Action) : undefined;
}

export function useDictateCommand(setTab: (t: AppTab) => void) {
  const [prefill, setPrefill] = useState<string | undefined>(undefined);
  const [command, setCommand] = useState<DictationCommand>({ nonce: 0 });

  // Strip the one-shot ?deeplink= param after first consumption.
  const stripped = useRef(false);
  useEffect(() => {
    if (stripped.current) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("deeplink")) return;
    stripped.current = true;
    params.delete("deeplink");
    const qs = params.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  }, []);

  useDeepLink(
    useCallback(
      (link) => {
        if (link.target === "dictate") {
          const text = link.params.get("text");
          if (text) setPrefill(text);
          const mode = parseMode(link.params.get("mode")?.toLowerCase());
          const action = parseAction(link.params.get("action")?.toLowerCase());
          if (mode || action) {
            setCommand((c) => ({ nonce: c.nonce + 1, mode, action }));
          }
          setTab("dictate");
        } else if (link.target === "snippets") {
          setTab("snippets");
        } else if (link.target === "history") {
          setTab("history");
        }
      },
      [setTab],
    ),
  );

  return { prefill, command };
}
