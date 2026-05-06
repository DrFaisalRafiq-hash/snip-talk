import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const isTray =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("tray") === "1";

type Binding = { id: string; accelerator: string; content: string; title?: string };

/**
 * Tray-only sync: subscribes to the user's snippets and registers any
 * non-empty `shortcut` as a system-wide global accelerator that pastes
 * the snippet into the active app. No-op outside the tray window.
 */
export function useSnippetGlobalShortcuts(userId: string | undefined) {
  const [accessibilityTrusted, setAccessibilityTrusted] = useState<boolean>(true);
  const [hasBindings, setHasBindings] = useState(false);

  useEffect(() => {
    if (!isTray || !userId || !window.sniptalk?.setSnippetShortcuts) return;

    let cancelled = false;

    const push = async () => {
      const { data, error } = await supabase
        .from("snippets")
        .select("id,title,content,shortcut")
        .not("shortcut", "is", null);
      if (error || cancelled) return;
      const bindings: Binding[] = (data ?? [])
        .filter((s) => s.shortcut && s.content)
        .map((s) => ({
          id: s.id,
          accelerator: s.shortcut as string,
          content: s.content,
          title: s.title,
        }));
      setHasBindings(bindings.length > 0);
      const result = await window.sniptalk!.setSnippetShortcuts!(bindings);
      const failed = result.snippets.filter((r) => !r.ok);
      if (failed.length) {
        toast.error(
          `${failed.length} snippet shortcut${failed.length > 1 ? "s" : ""} couldn't be registered (likely a system conflict).`
        );
      }
      // After registering, check Accessibility — needed for paste to work
      if (bindings.length && window.sniptalk?.getAccessibilityStatus) {
        const s = await window.sniptalk.getAccessibilityStatus(false);
        if (!cancelled) setAccessibilityTrusted(s.trusted);
      }
    };

    push();

    // Live updates when snippets change
    const channel = supabase
      .channel("snippet-shortcuts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "snippets" },
        () => push()
      )
      .subscribe();

    const offPasted = window.sniptalk?.onSnippetPasted?.((p) =>
      toast.success(`Pasted "${p.title || "snippet"}"`)
    );
    const offError = window.sniptalk?.onSnippetPasteError?.((m) => toast.error(m));

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      offPasted?.();
      offError?.();
    };
  }, [userId]);

  return {
    isTray,
    hasBindings,
    accessibilityTrusted,
    requestAccessibility: async () => {
      const s = await window.sniptalk?.getAccessibilityStatus?.(true);
      if (s) setAccessibilityTrusted(s.trusted);
    },
    openSettings: () => window.sniptalk?.openAccessibilitySettings?.(),
  };
}
