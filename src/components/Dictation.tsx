import { useCallback, useState, useEffect, useRef } from "react";
import { useScribe } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Mic, Square, Copy, Trash2 } from "lucide-react";

export function Dictation() {
  const [partial, setPartial] = useState("");
  const [committed, setCommitted] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const wasConnected = useRef(false);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: "vad",
    onPartialTranscript: (d: any) => setPartial(d?.text ?? ""),
    onCommittedTranscript: (d: any) => {
      setCommitted((prev) => [...prev, d?.text ?? ""]);
      setPartial("");
    },
  });

  useEffect(() => {
    wasConnected.current = scribe.isConnected;
  }, [scribe.isConnected]);

  const start = useCallback(async () => {
    setStarting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const { data, error } = await supabase.functions.invoke("elevenlabs-token");
      if (error || !data?.token) throw new Error(error?.message ?? "No token");
      await scribe.connect({
        token: data.token,
        microphone: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setStarting(false);
    }
  }, [scribe]);

  const stop = useCallback(async () => {
    try { await scribe.disconnect(); } catch {}
  }, [scribe]);

  const fullText = [...committed, partial].filter(Boolean).join(" ");

  const copy = async () => {
    if (!fullText) return;
    await navigator.clipboard.writeText(fullText);
    toast.success("Copied");
  };

  const clear = () => { setCommitted([]); setPartial(""); };

  return (
    <div className="bg-card border rounded-2xl p-8 shadow-[var(--shadow-paper)]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className={`traffic-dot ${scribe.isConnected ? "bg-[hsl(var(--signal))] animate-pulse-dot" : "bg-muted-foreground/30"}`} />
          <span className="font-mono-tight text-xs uppercase tracking-widest text-muted-foreground">
            {scribe.isConnected ? "Listening" : starting ? "Connecting" : "Idle"}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={copy} disabled={!fullText}><Copy className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={clear} disabled={!fullText}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="min-h-[260px] rounded-xl bg-background/60 border border-dashed p-6 mb-6">
        {fullText ? (
          <p className="font-serif-display text-3xl leading-snug text-foreground">
            {committed.join(" ")}{" "}
            <span className="text-muted-foreground italic">{partial}</span>
          </p>
        ) : (
          <p className="font-serif-display text-2xl text-muted-foreground/60 italic">
            Press the mic and start speaking…
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-4">
        {scribe.isConnected ? (
          <Button onClick={stop} size="lg" variant="destructive" className="rounded-full h-16 w-16 p-0">
            <Square className="h-5 w-5 fill-current" />
          </Button>
        ) : (
          <Button onClick={start} size="lg" disabled={starting} className="rounded-full h-16 w-16 p-0">
            <Mic className="h-6 w-6" />
          </Button>
        )}
        {scribe.isConnected && (
          <div className="flex items-end gap-1 h-10">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="bar w-1 bg-foreground rounded-full"
                style={{ height: "100%", animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
