import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dictation } from "@/components/Dictation";
import { ClipboardHistory } from "@/components/ClipboardHistory";
import { TextRewriter } from "@/components/TextRewriter";
import {
  MiniHeader,
  MiniTabBar,
  SnippetList,
  type MiniSnippet,
  type MiniTab,
} from "@/components/MiniSnippetsView";
import { recordClipboard } from "@/lib/clipboard";
import { MINI_H, MINI_W } from "@/lib/mini-mode";

type ElectronBridge = {
  setTraySnippets?: (
    list: Array<{ id: string; title: string; content: string }>,
  ) => Promise<unknown> | unknown;
};

function pushToTray(snippets: MiniSnippet[]): void {
  const bridge = (window as unknown as { sniptalk?: ElectronBridge }).sniptalk;
  if (!bridge?.setTraySnippets) return;
  try {
    bridge.setTraySnippets(snippets.map((s) => ({ id: s.id, title: s.title, content: s.content })));
  } catch {
    /* ignore */
  }
}

export function MiniSnippets({ userId, onExit }: { userId: string; onExit: () => void }) {
  const [tab, setTab] = useState<MiniTab>("snippets");
  const [items, setItems] = useState<MiniSnippet[]>([]);
  const [filter, setFilter] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("snippets")
      .select("*")
      .order("updated_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const next = data ?? [];
    setItems(next);
    pushToTray(next);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("snippets-mini")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "snippets" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const copy = useCallback(
    async (s: MiniSnippet) => {
      try {
        await navigator.clipboard.writeText(s.content);
        await recordClipboard(userId, s.content, "snippet");
        setCopiedId(s.id);
        setTimeout(() => setCopiedId((id) => (id === s.id ? null : id)), 900);
      } catch {
        toast.error("Couldn't copy to clipboard");
      }
    },
    [userId],
  );

  return (
    <div
      className="fixed inset-0 z-[60] bg-background paper-grain flex flex-col mini-shell"
      style={{ maxWidth: MINI_W, maxHeight: MINI_H, margin: "0 auto" }}
    >
      <MiniHeader tab={tab} onExit={onExit} />
      <MiniTabBar tab={tab} onSelect={setTab} />

      <div className="flex-1 overflow-y-auto">
        {tab === "snippets" && (
          <SnippetList
            snippets={items}
            loading={loading}
            filter={filter}
            setFilter={setFilter}
            copiedId={copiedId}
            onCopy={copy}
          />
        )}
        {tab === "dictate" && (
          <div className="p-3">
            <Dictation userId={userId} />
          </div>
        )}
        {tab === "rewrite" && (
          <div className="p-3">
            <TextRewriter userId={userId} />
          </div>
        )}
        {tab === "history" && (
          <div className="p-3">
            <ClipboardHistory userId={userId} />
          </div>
        )}
      </div>

      <footer className="border-t px-3 py-1.5 text-[10px] font-mono-tight uppercase tracking-widest text-muted-foreground text-center">
        {tab === "snippets" ? `Click to copy · ${items.length} total` : "Mini mode"}
      </footer>
    </div>
  );
}
