// Presentational pieces for the mini snippet picker. State lives in the parent.

import { Check, Copy, History, Loader2, Maximize2, Mic, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";

export type MiniTab = "snippets" | "dictate" | "history" | "rewrite";

export type MiniSnippet = {
  id: string;
  title: string;
  content: string;
  shortcut: string | null;
  updated_at: string;
};

const TABS = [
  { id: "snippets", icon: Copy, label: "Snippets" },
  { id: "dictate", icon: Mic, label: "Dictate" },
  { id: "rewrite", icon: Sparkles, label: "AI" },
  { id: "history", icon: History, label: "History" },
] as const;

export function MiniHeader({ tab, onExit }: { tab: MiniTab; onExit: () => void }) {
  return (
    <header className="flex items-center gap-2 px-3 py-2 border-b bg-background/90 backdrop-blur">
      <Logo size={16} />
      <span className="font-serif-display text-sm flex-1 capitalize">{tab}</span>
      <button
        onClick={onExit}
        className="p-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors"
        aria-label="Exit mini mode"
        title="Expand window"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
    </header>
  );
}

export function MiniTabBar({ tab, onSelect }: { tab: MiniTab; onSelect: (t: MiniTab) => void }) {
  return (
    <nav className="flex border-b bg-background/60">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-mono-tight uppercase tracking-widest transition-colors ${
              active
                ? "text-foreground border-b-2 border-foreground bg-accent/30"
                : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
            }`}
            title={t.label}
          >
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function SnippetRow({
  snippet,
  copied,
  onCopy,
}: {
  snippet: MiniSnippet;
  copied: boolean;
  onCopy: (s: MiniSnippet) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onCopy(snippet)}
        className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors flex items-start gap-2 group"
        title="Click to copy"
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{snippet.title || "Untitled"}</div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {snippet.content || <em className="opacity-60">empty</em>}
          </div>
          {snippet.shortcut && (
            <div className="text-[10px] font-mono-tight uppercase tracking-widest text-muted-foreground/70 mt-1">
              {snippet.shortcut}
            </div>
          )}
        </div>
        <span
          className={`shrink-0 mt-0.5 text-muted-foreground group-hover:text-foreground transition-colors ${
            copied ? "text-foreground" : ""
          }`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </span>
      </button>
    </li>
  );
}

export function SnippetList({
  snippets,
  loading,
  filter,
  setFilter,
  copiedId,
  onCopy,
}: {
  snippets: MiniSnippet[];
  loading: boolean;
  filter: string;
  setFilter: (s: string) => void;
  copiedId: string | null;
  onCopy: (s: MiniSnippet) => void;
}) {
  const visible = snippets.filter((s) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q);
  });

  return (
    <>
      <div className="px-3 py-2 border-b sticky top-0 bg-background z-10">
        <input
          autoFocus
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search snippets…"
          className="w-full bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
        />
      </div>
      {loading ? (
        <div className="p-6 text-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
        </div>
      ) : visible.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground font-mono-tight uppercase tracking-widest">
          {snippets.length === 0 ? "No snippets yet" : "No matches"}
        </div>
      ) : (
        <ul className="divide-y">
          {visible.map((s) => (
            <SnippetRow key={s.id} snippet={s} copied={copiedId === s.id} onCopy={onCopy} />
          ))}
        </ul>
      )}
    </>
  );
}
