import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Pencil } from "lucide-react";

const MODIFIER_KEYS = new Set(["Meta", "Control", "Shift", "Alt", "OS"]);
const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

function eventToAccelerator(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("CommandOrControl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (!parts.length) return null;
  let key = e.key;
  if (key === " ") key = "Space";
  else if (key.length === 1) key = key.toUpperCase();
  parts.push(key);
  return parts.join("+");
}

export function formatAccelerator(a: string | null | undefined): string {
  if (!a) return "Set shortcut";
  return a
    .split("+")
    .map((p) => {
      if (p === "CommandOrControl") return isMac ? "⌘" : "Ctrl";
      if (p === "Shift") return "⇧";
      if (p === "Alt") return isMac ? "⌥" : "Alt";
      return p;
    })
    .join("+");
}

export function AcceleratorRecorder({
  value,
  onChange,
  className = "",
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  className?: string;
}) {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      const acc = eventToAccelerator(e);
      if (!acc) return;
      onChange(acc);
      setRecording(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, onChange]);

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono-tight text-[11px] uppercase tracking-widest transition ${
          recording
            ? "border-foreground bg-foreground/5 animate-pulse text-foreground"
            : "bg-background/60 text-muted-foreground hover:text-foreground hover:border-foreground/40"
        }`}
        title="Record a global keyboard shortcut"
      >
        {recording ? "Press keys…" : formatAccelerator(value)}
        {!recording && <Pencil className="h-2.5 w-2.5 opacity-60" />}
      </button>
      {value && !recording && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onChange(null)}
          title="Clear shortcut"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
