import { useCallback, useEffect, useState } from "react";
import { Mic, MicOff, ShieldAlert, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type MicStatus = "granted" | "denied" | "prompt" | "restricted" | "unknown" | "checking";

const LABELS: Record<MicStatus, string> = {
  granted: "Microphone granted",
  denied: "Microphone denied",
  prompt: "Permission needed",
  restricted: "Restricted by system",
  unknown: "Microphone status unknown",
  checking: "Checking microphone…",
};

const STYLES: Record<MicStatus, string> = {
  granted: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  denied: "bg-destructive/10 text-destructive border-destructive/30",
  prompt: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  restricted: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  unknown: "bg-muted text-muted-foreground border-border",
  checking: "bg-muted text-muted-foreground border-border",
};

function StatusIcon({ status }: { status: MicStatus }) {
  if (status === "checking") return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  if (status === "granted") return <Mic className="h-3.5 w-3.5" />;
  if (status === "denied") return <MicOff className="h-3.5 w-3.5" />;
  if (status === "restricted") return <ShieldAlert className="h-3.5 w-3.5" />;
  return <AlertTriangle className="h-3.5 w-3.5" />;
}

export function MicrophoneStatus({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<MicStatus>("checking");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    // Insecure context (http on a non-localhost host) blocks getUserMedia entirely.
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setStatus("restricted");
      setError("Microphone requires a secure (HTTPS) context.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("restricted");
      setError("Microphone API not available in this browser.");
      return;
    }

    // Permissions API (Chromium, recent Firefox/Safari).
    try {
      const p = await navigator.permissions?.query({
        name: "microphone" as PermissionName,
      });
      if (p) {
        const map = (s: string): MicStatus =>
          s === "granted" ? "granted" : s === "denied" ? "denied" : "prompt";
        setStatus(map(p.state));
        p.onchange = () => setStatus(map(p.state));
        return;
      }
    } catch {
      // Permissions API not supported for "microphone" → fall through to unknown.
    }
    setStatus("unknown");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestPermission = useCallback(async () => {
    setError(null);
    setStatus("checking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // We only wanted the prompt; release the device immediately.
      stream.getTracks().forEach((t) => t.stop());
      setStatus("granted");
    } catch (e) {
      const err = e as DOMException;
      // NotAllowedError → user denied (or previously denied — browser won't re-prompt).
      // NotFoundError → no input device. SecurityError → insecure context / policy.
      if (err?.name === "NotAllowedError") {
        setStatus("denied");
        setError(
          "Permission was blocked. Update site settings in your browser to allow the microphone."
        );
      } else if (err?.name === "NotFoundError") {
        setStatus("restricted");
        setError("No microphone was detected on this device.");
      } else if (err?.name === "SecurityError" || err?.name === "NotSupportedError") {
        setStatus("restricted");
        setError(err.message || "Microphone access is restricted by the system.");
      } else {
        setStatus("unknown");
        setError(err?.message || "Could not access the microphone.");
      }
    }
  }, []);

  const showRequestButton = status === "prompt" || status === "denied" || status === "unknown";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-mono-tight uppercase tracking-wider ${STYLES[status]}`}
        role="status"
        aria-live="polite"
        title={error || LABELS[status]}
      >
        <StatusIcon status={status} />
        <span>{LABELS[status]}</span>
      </div>

      {showRequestButton && (
        <Button variant="outline" size="sm" onClick={requestPermission}>
          {status === "denied" ? "Try again" : "Request permission"}
        </Button>
      )}

      {error && (
        <span className="text-xs text-muted-foreground max-w-xs truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
