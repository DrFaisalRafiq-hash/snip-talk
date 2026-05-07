import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useScribeSession } from "@/hooks/useScribeSession";
import { recordClipboard } from "@/lib/clipboard";
import {
  DEFAULT_REWRITE_STYLE_ID,
  REWRITE_STYLES,
} from "@/lib/rewrite-styles";
import {
  RewriteActions,
  RewriteInput,
  RewriteOutput,
  StyleChips,
} from "@/components/TextRewriterView";

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
  const [style, setStyle] = useState<string>(DEFAULT_REWRITE_STYLE_ID);
  const [extra, setExtra] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  // Snapshot of `input` at the moment dictation starts. Live partial transcript
  // is appended visually; on commit it's folded into the snapshot so the
  // textarea remains the single source of truth.
  const baseTextRef = useRef("");
  const [livePartial, setLivePartial] = useState("");

  const { scribe, starting: dictateStarting, start, stop } = useScribeSession({
    onPartialTranscript: setLivePartial,
    onCommittedTranscript: (text) => {
      const chunk = text.trim();
      if (!chunk) return;
      baseTextRef.current = baseTextRef.current
        ? `${baseTextRef.current} ${chunk}`
        : chunk;
      setInput(baseTextRef.current);
      setLivePartial("");
    },
  });

  const startDictation = useCallback(async () => {
    if (scribe.isConnected || dictateStarting) return;
    baseTextRef.current = input;
    setLivePartial("");
    await start();
  }, [scribe.isConnected, dictateStarting, input, start]);

  const stopDictation = useCallback(async () => {
    await stop();
    if (livePartial.trim()) {
      const merged = baseTextRef.current
        ? `${baseTextRef.current} ${livePartial.trim()}`
        : livePartial.trim();
      baseTextRef.current = merged;
      setInput(merged);
    }
    setLivePartial("");
  }, [stop, livePartial]);

  // Cleanly disconnect if the component unmounts mid-dictation.
  useEffect(() => {
    return () => {
      if (scribe.isConnected) {
        stop();
      }
    };
    // Run only on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      <RewriteInput
        input={input}
        setInput={setInput}
        livePartial={livePartial}
        isConnected={scribe.isConnected}
        starting={dictateStarting}
        onToggleDictation={scribe.isConnected ? stopDictation : startDictation}
      />

      <StyleChips selected={style} onSelect={setStyle} />
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

      <RewriteActions
        loading={loading}
        inputEmpty={!input.trim()}
        output={output}
        onRun={run}
        onCopy={copy}
        onUseAsInput={useAsInput}
        onReplace={
          onReplace
            ? () => {
                onReplace(output);
                toast.success("Replaced transcript");
              }
            : undefined
        }
      />

      <RewriteOutput output={output} />
    </div>
  );
}
