import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Maximize2, Mic, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { recordClipboard } from "@/lib/clipboard";
import { Logo } from "@/components/Logo";

type Snippet = {
  id: string;
  title: string;
  content: string;
  shortcut: string | null;
  updated_at: string;
};

type ElectronBridge = {
  setMiniMode?: (enabled: boolean) => Promise<unknown> | unknown;
  setTraySnippets?: (
    list: Array<{ id: string; title: string; content: string }>,
  ) => Promise<unknown> | unknown;
};

const MINI_KEY = "sniptalk:miniMode";
const MINI_W = 340;
const MINI_H = 460;

export function isMiniMode(): boolean {
  try {
    return localStorage.getItem(MINI_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMiniMode(enabled: boolean) {
  try {
    localStorage.setItem(MINI_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
  // Talk to Electron tray/main if present so the OS window actually shrinks.
  const bridge = (window as unknown as { sniptalk?: ElectronBridge }).sniptalk;
  if (bridge?.setMiniMode) {
    try {
      bridge.setMiniMode(enabled);
    } catch {
      /* ignore */
    }
  }
  // Reflect on <html> so layout-level styles can react if needed.
  document.documentElement.classList.toggle("mini-mode", enabled);
  // In a regular browser window, also try resizeTo (only works for windows
  // opened via window.open, but is a no-op otherwise — safe to call).
  if (enabled) {
    try {
      window.resizeTo(MINI_W, MINI_H);
    } catch {
      /* ignore */
    }
  }
}

export function MiniSnippets({
  userId,
  onExit,
}: {
  userId: string;
  onExit: () => void;
}) {
  const [items, setItems] = useState<Snippet[]>([]);
  const [filter, setFilter] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("snippets")
      .select("*")
      .order("updated_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setItems(data ?? []);
    // Mirror the list into the menu-bar (tray) right-click menu, if we're
    // running inside the Electron tray window.
    const bridge = (window as unknown as { sniptalk?: ElectronBridge }).sniptalk;
    if (bridge?.setTraySnippets) {
      try {
        bridge.setTraySnippets(
          (data ?? []).map((s) => ({ id: s.id, title: s.title, content: s.content })),
        );
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    load();
    // Realtime so newly-added snippets appear without a refresh.
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

  const copy = async (s: Snippet) => {
    try {
      await navigator.clipboard.writeText(s.content);
      await recordClipboard(userId, s.content, "snippet");
      setCopiedId(s.id);
      setTimeout(() => setCopiedId((id) => (id === s.id ? null : id)), 900);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  const visible = items.filter((s) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.content.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="fixed inset-0 z-[60] bg-background paper-grain flex flex-col"
      style={{ maxWidth: MINI_W, maxHeight: MINI_H, margin: "0 auto" }}
    >
      <header className="flex items-center gap-2 px-3 py-2 border-b bg-background/90 backdrop-blur">
        <Logo size={16} />
        <span className="font-serif-display text-sm flex-1">Snippets</span>
        <button
          onClick={() => {
            // Trigger a one-shot dictate via hash route + restore window.
            onExit();
            window.location.hash = "#dictate";
          }}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors"
          aria-label="Open dictation"
          title="Dictate"
        >
          <Mic className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onExit}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors"
          aria-label="Exit mini mode"
          title="Expand window"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="px-3 py-2 border-b">
        <input
          autoFocus
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search snippets…"
          className="w-full bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
          </div>
        ) : visible.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground font-mono-tight uppercase tracking-widest">
            {items.length === 0 ? "No snippets yet" : "No matches"}
          </div>
        ) : (
          <ul className="divide-y">
            {visible.map((s) => {
              const copied = copiedId === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => copy(s)}
                    className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors flex items-start gap-2 group"
                    title="Click to copy"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {s.title || "Untitled"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {s.content || <em className="opacity-60">empty</em>}
                      </div>
                      {s.shortcut && (
                        <div className="text-[10px] font-mono-tight uppercase tracking-widest text-muted-foreground/70 mt-1">
                          {s.shortcut}
                        </div>
                      )}
                    </div>
                    <span
                      className={`shrink-0 mt-0.5 text-muted-foreground group-hover:text-foreground transition-colors ${
                        copied ? "text-foreground" : ""
                      }`}
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="border-t px-3 py-1.5 text-[10px] font-mono-tight uppercase tracking-widest text-muted-foreground text-center">
        Click to copy · {items.length} total
      </footer>
    </div>
  );
}
