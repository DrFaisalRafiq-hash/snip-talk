import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Copy, Trash2 } from "lucide-react";
import { recordClipboard } from "@/lib/clipboard";
import { AcceleratorRecorder, formatAccelerator } from "@/components/AcceleratorRecorder";

type Snippet = {
  id: string;
  title: string;
  content: string;
  shortcut: string | null;
  updated_at: string;
};

export function Snippets({ userId }: { userId: string }) {
  const [items, setItems] = useState<Snippet[]>([]);
  const [active, setActive] = useState<Snippet | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("snippets")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) return toast.error(error.message);
    setItems(data ?? []);
    if (!active && data?.length) setActive(data[0]);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    const { data, error } = await supabase
      .from("snippets")
      .insert({ user_id: userId, title: "Untitled", content: "" })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setItems([data, ...items]);
    setActive(data);
  };

  const save = async (patch: Partial<Snippet>) => {
    if (!active) return;
    const next = { ...active, ...patch };
    setActive(next);
    setItems((arr) => arr.map((s) => (s.id === next.id ? next : s)));
    const { error } = await supabase.from("snippets").update(patch).eq("id", active.id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("snippets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    const next = items.filter((s) => s.id !== id);
    setItems(next);
    setActive(next[0] ?? null);
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    await recordClipboard(userId, text, "snippet");
    toast.success("Copied");
  };

  return (
    <div className="bg-card border rounded-2xl shadow-[var(--shadow-paper)] overflow-hidden grid grid-cols-[260px_1fr] min-h-[480px]">
      <aside className="border-r bg-background/40 flex flex-col">
        <div className="p-4 flex items-center justify-between border-b">
          <span className="font-mono-tight text-xs uppercase tracking-widest text-muted-foreground">
            Snippets
          </span>
          <Button size="icon" variant="ghost" onClick={create}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground">No snippets yet.</p>
          )}
          {items.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s)}
              className={`w-full text-left px-4 py-3 border-b transition ${
                active?.id === s.id ? "bg-secondary" : "hover:bg-secondary/50"
              }`}
            >
              <div className="text-sm font-medium truncate">{s.title || "Untitled"}</div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {s.content || "Empty"}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="p-6 flex flex-col gap-4">
        {active ? (
          <>
            <div className="flex items-center gap-2">
              <Input
                value={active.title}
                onChange={(e) => save({ title: e.target.value })}
                placeholder="Title"
                className="font-serif-display text-2xl border-0 bg-transparent px-0 focus-visible:ring-0 h-auto"
              />
              <Button variant="ghost" size="icon" onClick={() => copy(active.content)}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(active.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Input
              value={active.shortcut ?? ""}
              onChange={(e) => save({ shortcut: e.target.value || null })}
              placeholder="Shortcut e.g. /sig"
              className="font-mono-tight text-xs max-w-xs"
            />
            <Textarea
              value={active.content}
              onChange={(e) => save({ content: e.target.value })}
              placeholder="Write your snippet…"
              className="flex-1 min-h-[280px] resize-none text-base leading-relaxed"
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Create your first snippet.
          </div>
        )}
      </section>
    </div>
  );
}
