import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, Copy, ArrowDownToLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { recordClipboard } from "@/lib/clipboard";

export type RewriteStyle = {
  id: string;
  label: string;
  hint: string;
};

// Mirrors the styles in the expand-text edge function. The server is the source
// of truth for the actual prompt — this list is just for the picker UI.
export const REWRITE_STYLES: RewriteStyle[] = [
  { id: "email-formal", label: "Email · Formal", hint: "Polished business email with subject" },
  { id: "email-concise", label: "Email · Concise", hint: "Under 80 words, direct" },
  { id: "email-friendly", label: "Email · Friendly", hint: "Warm, conversational" },
  { id: "instructions", label: "Instructions", hint: "Numbered step-by-step" },
  { id: "bullets", label: "Bullets", hint: "3–7 tight bullet points" },
  { id: "meeting", label: "Meeting notes", hint: "Decisions, actions, questions" },
  { id: "slack", label: "Slack message", hint: "Short, scannable, friendly" },
  { id: "polish", label: "Polish", hint: "Light edit, same meaning" },
  { id: "expand", label: "Expand", hint: "Terse → full prose" },
];

export function TextRewriter({
  userId,
  initialText = "",
  onReplace,
}: {
  userId: string;
  initialText?: string;
  /** Optional callback — when present, an "Use as transcript" button appears. */
  onReplace?: (text: string) => void;
}) {
  const [input, setInput] = useState(initialText);
  const [style, setStyle] = useState<string>("polish");
  const [extra, setExtra] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  // When the parent's transcript changes (e.g. dictation finishes), pull it in
  // unless the user has started editing. Cheap heuristic: only sync if the
  // textarea is empty or matches a previous initialText.
  if (initialText && !input) {
    // Lazy init in render is fine — useState already captured the first value.
  }

  const run = async () => {
    const text = input.trim();
    if (!text) {
      toast.error("Type or paste some text first");
      return;
    }
    setLoading(true);
    setOutput("");
    try {
      const { data, error } = await supabase.functions.invoke("expand-text", {
        body: { text, style, instructions: extra.trim() || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setOutput(data?.output ?? "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to rewrite";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    await recordClipboard(userId, output, "dictation");
    toast.success("Copied");
  };

  const useAsInput = () => {
    if (!output) return;
    setInput(output);
    setOutput("");
  };

  const pull = () => {
    if (!initialText) {
      toast.message("No transcript yet", { description: "Dictate or paste something first." });
      return;
    }
    setInput(initialText);
  };

  const active = REWRITE_STYLES.find((s) => s.id === style);

  return (
    <div className="bg-card border rounded-2xl p-6 shadow-[var(--shadow-paper)] mt-6">
      <div className="flex items-center gap-3 mb-4">
        <Sparkles className="h-4 w-4 text-foreground" />
        <span className="font-mono-tight text-xs uppercase tracking-widest text-muted-foreground">
          AI rewrite
        </span>
        {initialText && (
          <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={pull}>
            ↓ Pull transcript
          </Button>
        )}
      </div>

      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste a draft, or pull in your dictation transcript above…"
        className="min-h-[100px] mb-4 font-serif-display text-base"
      />

      {/* Style chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {REWRITE_STYLES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStyle(s.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-mono-tight uppercase tracking-wider border transition ${
              style === s.id
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:text-foreground"
            }`}
            title={s.hint}
          >
            {s.label}
          </button>
        ))}
      </div>
      {active && (
        <p className="text-xs text-muted-foreground mb-4 italic">{active.hint}</p>
      )}

      <Input
        value={extra}
        onChange={(e) => setExtra(e.target.value)}
        placeholder="Optional extra instructions (e.g. 'address it to Sam', 'in French', 'keep under 50 words')"
        className="mb-4"
        maxLength={500}
      />

      <div className="flex items-center gap-3 mb-4">
        <Button onClick={run} disabled={loading || !input.trim()}>
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
            <Button variant="ghost" size="sm" onClick={copy}>
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            {onReplace && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onReplace(output);
                  toast.success("Replaced transcript");
                }}
              >
                <ArrowDownToLine className="h-4 w-4" />
                Use as transcript
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={useAsInput}>
              ↑ Use as input
            </Button>
          </>
        )}
      </div>

      {output && (
        <div className="rounded-xl bg-background/60 border border-dashed p-5 animate-fade-in">
          <pre className="font-serif-display text-base whitespace-pre-wrap text-foreground leading-relaxed font-[inherit]">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}
