import { useCallback, useState, useEffect } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Mic, MicOff, Square, Copy, Trash2, ShieldAlert } from "lucide-react";
import {
  queryMicPermission,
  requestMicPermission,
  micDeniedMessage,
  isMac,
  isElectron,
  type MicPermissionState,
} from "@/lib/mic";

export function Dictation() {
  const [partial, setPartial] = useState("");
  const [committed, setCommitted] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [micState, setMicState] = useState<MicPermissionState>("unknown");

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (d: any) => setPartial(d?.text ?? ""),
    onCommittedTranscript: (d: any) => {
      setCommitted((prev) => [...prev, d?.text ?? ""]);
      setPartial("");
    },
  });

  // Initial permission probe + live updates when the user changes it in the OS/browser.
  useEffect(() => {
    let cancelled = false;
    queryMicPermission().then((s) => !cancelled && setMicState(s));
    let status: any;
    (navigator as any).permissions
      ?.query?.({ name: "microphone" as PermissionName })
      .then((s: any) => {
        status = s;
        s.onchange = () => setMicState(s.state as MicPermissionState);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, []);

  const start = useCallback(async () => {
    setStarting(true);
    try {
      const perm = await requestMicPermission();
      setMicState(perm.state);
      if (perm.state !== "granted") {
        const m = micDeniedMessage();
        if (perm.state === "denied") {
          toast.error(m.title, { description: m.steps.join(" • ") });
        } else {
          toast.error(perm.error ?? "Microphone unavailable");
        }
        return;
      }
      // Stop the probe stream immediately — Scribe opens its own.
      perm.stream?.getTracks().forEach((t) => t.stop());

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

  // Keyboard shortcut: ⌘/Ctrl + Shift + D toggles dictation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.shiftKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        if (scribe.isConnected) stop();
        else if (!starting) start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scribe.isConnected, starting, start, stop]);

  const fullText = [...committed, partial].filter(Boolean).join(" ");

  const copy = async () => {
    if (!fullText) return;
    await navigator.clipboard.writeText(fullText);
    toast.success("Copied");
  };

  const clear = () => { setCommitted([]); setPartial(""); };

  const denied = micState === "denied" || micState === "unsupported";
  const denyInfo = micDeniedMessage();

  return (
    <div className="bg-card border rounded-2xl p-8 shadow-[var(--shadow-paper)]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className={`traffic-dot ${scribe.isConnected ? "bg-[hsl(var(--signal))]" : "bg-muted-foreground/30"}`} />
          <span className="font-mono-tight text-xs uppercase tracking-widest text-muted-foreground">
            {scribe.isConnected ? "Listening" : starting ? "Connecting" : denied ? "Mic blocked" : "Idle"}
          </span>
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-background/60 px-1.5 py-0.5 font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground">
            {isMac ? "⌘" : "Ctrl"}+⇧+D
          </kbd>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={copy} disabled={!fullText}><Copy className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={clear} disabled={!fullText}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {denied && (
        <div className="mb-5 rounded-xl border border-destructive/40 bg-destructive/5 p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-mono-tight text-xs uppercase tracking-widest text-destructive mb-2">
                {denyInfo.title}
              </p>
              <ol className="text-sm text-foreground/80 space-y-1 list-decimal list-inside">
                {denyInfo.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
              {isMac && isElectron && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => window.open("x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")}
                >
                  Open System Settings
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="min-h-[260px] rounded-xl bg-background/60 border border-dashed p-6 mb-6">
        {fullText ? (
          <p className="font-serif-display text-3xl leading-snug text-foreground">
            {committed.join(" ")}{" "}
            <span className="text-muted-foreground italic">{partial}</span>
          </p>
        ) : (
          <p className="font-serif-display text-2xl text-muted-foreground/60 italic">
            {denied ? "Grant microphone access above to start dictating…" : "Press the mic and start speaking…"}
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-4">
        {scribe.isConnected ? (
          <Button onClick={stop} size="lg" variant="destructive" className="rounded-full h-16 w-16 p-0">
            <Square className="h-5 w-5 fill-current" />
          </Button>
        ) : (
          <Button
            onClick={start}
            size="lg"
            disabled={starting || micState === "unsupported"}
            className="rounded-full h-16 w-16 p-0"
          >
            {denied ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
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
