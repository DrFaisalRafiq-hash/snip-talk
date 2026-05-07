// Presentational pieces for TextRewriter. State + handlers live in the parent.

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDownToLine, Copy, Loader2, Mic, Sparkles, Square } from "lucide-react";
import { REWRITE_STYLES } from "@/lib/rewrite-styles";

export function RewriteInput({
  input,
  setInput,
  livePartial,
  isConnected,
  starting,
  onToggleDictation,
}: {
  input: string;
  setInput: (s: string) => void;
  livePartial: string;
  isConnected: boolean;
  starting: boolean;
  onToggleDictation: () => void;
}) {
  return (
    <div className="relative mb-4">
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste a draft, dictate with the mic, or pull your transcript…"
        className="min-h-[120px] pr-14 font-serif-display text-base"
      />
      {livePartial && (
        <div className="px-3 pt-2 text-sm text-muted-foreground italic">…{livePartial}</div>
      )}
      <Button
        type="button"
        size="icon"
        variant={isConnected ? "destructive" : "outline"}
        onClick={onToggleDictation}
        disabled={starting}
        className="absolute top-2 right-2 h-9 w-9 rounded-full"
        title={isConnected ? "Stop dictation" : "Dictate"}
        aria-label={isConnected ? "Stop dictation" : "Dictate"}
      >
        {starting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isConnected ? (
          <Square className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
      {isConnected && (
        <span className="absolute bottom-2 right-3 text-[10px] font-mono-tight uppercase tracking-widest text-[hsl(var(--signal))]">
          ● Listening
        </span>
      )}
    </div>
  );
}

export function StyleChips({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {REWRITE_STYLES.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={`px-3 py-1.5 rounded-full text-xs font-mono-tight uppercase tracking-wider border transition ${
            selected === s.id
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:text-foreground"
          }`}
          title={s.hint}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export function RewriteActions({
  loading,
  inputEmpty,
  output,
  onRun,
  onCopy,
  onUseAsInput,
  onReplace,
}: {
  loading: boolean;
  inputEmpty: boolean;
  output: string;
  onRun: () => void;
  onCopy: () => void;
  onUseAsInput: () => void;
  onReplace?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <Button onClick={onRun} disabled={loading || inputEmpty}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Rewriting…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Rewrite
          </>
        )}
      </Button>
      {output && (
        <>
          <Button variant="ghost" size="sm" onClick={onCopy}>
            <Copy className="h-4 w-4" />
            Copy
          </Button>
          {onReplace && (
            <Button variant="ghost" size="sm" onClick={onReplace}>
              <ArrowDownToLine className="h-4 w-4" />
              Use as transcript
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onUseAsInput}>
            ↑ Use as input
          </Button>
        </>
      )}
    </div>
  );
}

export function RewriteOutput({ output }: { output: string }) {
  if (!output) return null;
  return (
    <div className="rounded-xl bg-background/60 border border-dashed p-5 animate-fade-in">
      <pre className="font-serif-display text-base whitespace-pre-wrap text-foreground leading-relaxed font-[inherit]">
        {output}
      </pre>
    </div>
  );
}
