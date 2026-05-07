// Shared lifecycle for an ElevenLabs Scribe live transcription session.
//
// Wraps the three steps every caller does the same way:
//   1) request mic permission (with macOS-aware messaging)
//   2) fetch a short-lived ElevenLabs token from the Supabase edge function
//   3) connect to scribe with realtime VAD + the provided callbacks
//
// Caller owns transcript state, because the two existing consumers shape it
// differently (Dictation keeps committed: string[]; TextRewriter folds into a
// single string buffer).

import { useCallback, useState } from "react";
import { CommitStrategy, useScribe } from "@elevenlabs/react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { micDeniedMessage, requestMicPermission } from "@/lib/mic";

const SCRIBE_MODEL_ID = "scribe_v2_realtime";

export type ScribeSessionCallbacks = {
  onPartialTranscript: (text: string) => void;
  onCommittedTranscript: (text: string) => void;
};

export function useScribeSession({
  onPartialTranscript,
  onCommittedTranscript,
}: ScribeSessionCallbacks) {
  const [starting, setStarting] = useState(false);

  const scribe = useScribe({
    modelId: SCRIBE_MODEL_ID,
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (d) => onPartialTranscript(d?.text ?? ""),
    onCommittedTranscript: (d) => onCommittedTranscript(d?.text ?? ""),
  });

  const start = useCallback(async () => {
    if (scribe.isConnected) return false;
    setStarting(true);
    try {
      const perm = await requestMicPermission();
      if (perm.state !== "granted") {
        const m = micDeniedMessage();
        if (perm.state === "denied") {
          toast.error(m.title, { description: m.steps.join(" • ") });
        } else {
          toast.error(perm.error ?? "Microphone unavailable");
        }
        return false;
      }
      // Stop the probe stream immediately — Scribe opens its own.
      perm.stream?.getTracks().forEach((t) => t.stop());

      const { data, error } = await supabase.functions.invoke("elevenlabs-token");
      if (error || !data?.token) throw new Error(error?.message ?? "No token");
      await scribe.connect({
        token: data.token,
        microphone: { echoCancellation: true, noiseSuppression: true },
      });
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start dictation");
      return false;
    } finally {
      setStarting(false);
    }
  }, [scribe]);

  const stop = useCallback(async () => {
    try {
      await scribe.disconnect();
    } catch (e) {
      // Disconnect can throw when the session already torn down — log so we
      // notice unexpected failure modes, but don't surface to the user.
      console.warn("[scribe] disconnect failed", e);
    }
  }, [scribe]);

  return {
    scribe,
    starting,
    start,
    stop,
    isConnected: scribe.isConnected,
  };
}
