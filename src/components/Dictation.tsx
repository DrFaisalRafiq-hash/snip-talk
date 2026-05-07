import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { TextRewriter } from "@/components/TextRewriter";
import {
  DictationControls,
  DictationDisplay,
  DictationHeader,
  MicDeniedNotice,
} from "@/components/DictationView";
import { useScribeSession } from "@/hooks/useScribeSession";
import { useMicPermission } from "@/hooks/useMicPermission";
import { recordClipboard } from "@/lib/clipboard";
import { matchesShortcut, useShortcut } from "@/lib/shortcut";

export type DictationCommand = {
  /** Bumped each time the deep link arrives so effects re-run on repeats. */
  nonce: number;
  /** "live" -> auto-start, "stop" -> auto-stop, "toggle" -> flip current state. */
  mode?: "live" | "stop" | "toggle" | "pause" | "resume";
  /** "copy" -> copy current transcript, "clear" -> wipe transcript. */
  action?: "copy" | "clear";
};

type DictationProps = {
  userId: string;
  prefill?: string;
  command?: DictationCommand;
};

export function Dictation({ userId, prefill, command }: DictationProps) {
  const [partial, setPartial] = useState("");
  const [committed, setCommitted] = useState<string[]>(prefill ? [prefill] : []);
  const [paused, setPaused] = useState(false);
  const micState = useMicPermission();

  const { scribe, starting, start: startSession, stop: stopSession } = useScribeSession({
    onPartialTranscript: setPartial,
    onCommittedTranscript: (text) => {
      setCommitted((prev) => [...prev, text]);
      setPartial("");
    },
  });

  // Apply prefill whenever a new value arrives (e.g. another deep link).
  useEffect(() => {
    if (prefill && prefill.trim()) {
      setCommitted([prefill]);
      setPartial("");
    }
  }, [prefill]);

  const start = useCallback(async () => {
    const ok = await startSession();
    if (ok) setPaused(false);
  }, [startSession]);

  const stop = useCallback(async () => {
    await stopSession();
    setPaused(false);
  }, [stopSession]);

  // Pause = end the live session but keep the transcript so the user can
  // resume. Scribe doesn't expose a native pause, so we disconnect and
  // reconnect on resume.
  const pause = useCallback(async () => {
    if (!scribe.isConnected) return;
    await stopSession();
    // Promote any in-flight partial to committed so it isn't lost.
    setCommitted((prev) => (partial ? [...prev, partial] : prev));
    setPartial("");
    setPaused(true);
    toast.message("Paused", { description: "Recording will resume when you press play." });
  }, [scribe.isConnected, stopSession, partial]);

  const resume = useCallback(async () => {
    setPaused(false);
    await startSession();
  }, [startSession]);

  const fullText = [...committed, partial].filter(Boolean).join(" ");

  const copy = useCallback(async () => {
    if (!fullText) return;
    await navigator.clipboard.writeText(fullText);
    await recordClipboard(userId, fullText, "dictation");
    toast.success("Copied");
  }, [fullText, userId]);

  const clear = useCallback(() => {
    setCommitted([]);
    setPartial("");
  }, []);

  // Keyboard shortcut (user-editable) toggles dictation.
  const shortcut = useShortcut();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!matchesShortcut(e, shortcut)) return;
      e.preventDefault();
      if (scribe.isConnected) stop();
      else if (!starting) start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scribe.isConnected, starting, start, stop, shortcut]);

  // Deep-link command runner: react to ?mode=…&action=… arrivals.
  useEffect(() => {
    if (!command || !command.nonce) return;
    if (command.mode === "live" && !scribe.isConnected && !starting) start();
    else if (command.mode === "stop" && scribe.isConnected) stop();
    else if (command.mode === "pause" && scribe.isConnected) pause();
    else if (command.mode === "resume" && !scribe.isConnected && paused && !starting) resume();
    else if (command.mode === "toggle") {
      if (scribe.isConnected) pause();
      else if (paused && !starting) resume();
      else if (!starting) start();
    }
    if (command.action === "copy") copy();
    else if (command.action === "clear") clear();
    // Re-run only when a new command arrives, identified by its nonce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.nonce]);

  const denied = micState === "denied" || micState === "unsupported";

  return (
    <>
      <div className="bg-card border rounded-2xl p-8 shadow-[var(--shadow-paper)]">
        <DictationHeader
          isConnected={scribe.isConnected}
          starting={starting}
          paused={paused}
          denied={denied}
          fullText={fullText}
          onCopy={copy}
          onClear={clear}
        />

        {denied && <MicDeniedNotice />}

        <DictationDisplay
          committed={committed}
          partial={partial}
          fullText={fullText}
          denied={denied}
        />

        <DictationControls
          isConnected={scribe.isConnected}
          starting={starting}
          paused={paused}
          micState={micState}
          denied={denied}
          onStart={start}
          onStop={stop}
          onPause={pause}
          onResume={resume}
          onDiscard={() => {
            setPaused(false);
            clear();
          }}
        />
      </div>

      <TextRewriter
        userId={userId}
        initialText={fullText}
        onReplace={(t) => {
          setCommitted([t]);
          setPartial("");
        }}
      />
    </>
  );
}
