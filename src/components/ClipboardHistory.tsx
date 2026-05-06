import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Trash2, Pin, PinOff, Search, Mic, FileText, Hand } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Clip = {
  id: string;
  content: string;
  source: string;
  pinned: boolean;
  created_at: string;
};

const sourceIcon = (s: string) => {
  if (s === "dictation") return <Mic className="h-3 w-3" />;
  if (s === "snippet") return <FileText className="h-3 w-3" />;
  return <Hand className="h-3 w-3" />;
};

export function ClipboardHistory({ userId }: { userId: string }) {
  const [items, setItems] = useState<Clip[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("clipboard_history")
      .select("*")
      .eq("user_id", userId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    else setItems(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("clipboard_history_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clipboard_history", filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, userId]);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const togglePin = async (clip: Clip) => {
    const { error } = await supabase
      .from("clipboard_history")
      .update({ pinned: !clip.pinned })
      .eq("id", clip.id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("clipboard_history").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const clearAll = async () => {
    if (!confirm("Clear all unpinned clipboard history?")) return;
    const { error } = await supabase
      .from("clipboard_history")
      .delete()
      .eq("user_id", userId)
      .eq("pinned", false);
    if (error) toast.error(error.message);
  };

  const filtered = items.filter((c) =>
    !query.trim() ? true : c.content.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="bg-card border rounded-2xl shadow-[var(--shadow-paper)] p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clipboard…"
            className="pl-9"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={clearAll} disabled={!items.some((c) => !c.pinned)}>
          Clear
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-serif-display text-2xl text-muted-foreground/70 italic">
            {items.length === 0 ? "Nothing copied yet." : "No matches."}
          </p>
          <p className="text-xs text-muted-foreground mt-2 font-mono-tight uppercase tracking-widest">
            Copies from dictation and snippets land here automatically.
          </p>
        </div>
      ) : (
        <ul className="divide-y">
          {filtered.map((clip) => (
            <li key={clip.id} className="group py-3 flex items-start gap-3">
              <span
                className="mt-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-secondary text-muted-foreground"
                title={clip.source}
              >
                {sourceIcon(clip.source)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-relaxed line-clamp-3 break-words">
                  {clip.content}
                </p>
                <p className="text-[10px] uppercase tracking-widest font-mono-tight text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(clip.created_at), { addSuffix: true })}
                  {clip.pinned && " · pinned"}
                </p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <Button variant="ghost" size="icon" onClick={() => copy(clip.content)} title="Copy">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => togglePin(clip)} title={clip.pinned ? "Unpin" : "Pin"}>
                  {clip.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(clip.id)} title="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
