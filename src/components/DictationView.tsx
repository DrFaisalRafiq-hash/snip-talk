// Header / display / mic-denied notice for the Dictation feature.
// Pure view components — state and handlers come from the parent.

import { Button } from "@/components/ui/button";
import { Copy, Trash2, ShieldAlert } from "lucide-react";
import { ShortcutEditor } from "@/components/ShortcutEditor";
import { isElectron, isMac, micDeniedMessage } from "@/lib/mic";

export { DictationControls } from "@/components/DictationControls";

export function DictationHeader({
  isConnected,
  starting,
  paused,
  denied,
  fullText,
  onCopy,
  onClear,
}: {
  isConnected: boolean;
  starting: boolean;
  paused: boolean;
  denied: boolean;
  fullText: string;
  onCopy: () => void;
  onClear: () => void;
}) {
  const status = isConnected
    ? "Listening"
    : starting
    ? "Connecting"
    : paused
    ? "Paused"
    : denied
    ? "Mic blocked"
    : "Idle";
  const dotClass = isConnected
    ? "bg-[hsl(var(--signal))]"
    : paused
    ? "bg-amber-500"
    : "bg-muted-foreground/30";

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <span className={`traffic-dot ${dotClass}`} />
        <span className="font-mono-tight text-xs uppercase tracking-widest text-muted-foreground">
          {status}
        </span>
        <ShortcutEditor />
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="icon" onClick={onCopy} disabled={!fullText}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onClear} disabled={!fullText}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function MicDeniedNotice() {
  const denyInfo = micDeniedMessage();
  return (
    <div className="mb-5 rounded-xl border border-destructive/40 bg-destructive/5 p-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-mono-tight text-xs uppercase tracking-widest text-destructive mb-2">
            {denyInfo.title}
          </p>
          <ol className="text-sm text-foreground/80 space-y-1 list-decimal list-inside">
            {denyInfo.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {isMac && isElectron && (
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() =>
                window.open(
                  "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
                )
              }
            >
              Open System Settings
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function DictationDisplay({
  committed,
  partial,
  fullText,
  denied,
}: {
  committed: string[];
  partial: string;
  fullText: string;
  denied: boolean;
}) {
  return (
    <div className="min-h-[260px] rounded-xl bg-background/60 border border-dashed p-6 mb-6">
      {fullText ? (
        <p className="font-serif-display text-3xl leading-snug text-foreground">
          {committed.join(" ")} <span className="text-muted-foreground italic">{partial}</span>
        </p>
      ) : (
        <p className="font-serif-display text-2xl text-muted-foreground/60 italic">
          {denied
            ? "Grant microphone access above to start dictating…"
            : "Press the mic and start speaking…"}
        </p>
      )}
    </div>
  );
}
