import { useEffect, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Pencil, RotateCcw } from "lucide-react";
import {
  formatShortcut,
  loadShortcut,
  resetShortcut,
  saveShortcut,
  shortcutFromEvent,
  useShortcut,
  type Shortcut,
} from "@/lib/shortcut";
import { toast } from "sonner";

export function ShortcutEditor() {
  const current = useShortcut();
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [draft, setDraft] = useState<Shortcut>(current);
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setDraft(loadShortcut());
  }, [open]);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const s = shortcutFromEvent(e);
      if (!s) return; // wait for non-modifier
      if (!s.meta && !s.ctrl && !s.alt && !s.shift) {
        toast.error("Add at least one modifier (⌘, Ctrl, ⌥ or ⇧)");
        return;
      }
      setDraft(s);
      setRecording(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording]);

  const save = () => {
    saveShortcut(draft);
    toast.success(`Shortcut set to ${formatShortcut(draft)}`);
    setOpen(false);
  };

  const reset = () => {
    resetShortcut();
    setDraft(loadShortcut());
    toast.success("Shortcut reset to default");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="hidden sm:inline-flex items-center gap-1 rounded border bg-background/60 px-1.5 py-0.5 font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
          title="Edit shortcut"
        >
          {formatShortcut(current)}
          <Pencil className="h-2.5 w-2.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-4 space-y-3">
        <div>
          <p className="font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            Toggle dictation
          </p>
          <div
            ref={captureRef}
            tabIndex={0}
            onClick={() => setRecording(true)}
            onBlur={() => setRecording(false)}
            className={`w-full cursor-text rounded-md border px-3 py-3 text-center font-mono-tight text-sm transition ${
              recording
                ? "border-foreground bg-foreground/5 animate-pulse"
                : "bg-background/60 hover:border-foreground/40"
            }`}
          >
            {recording ? "Press your shortcut…" : formatShortcut(draft)}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Click the box, then press the keys you want. Must include a modifier.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5">
            <RotateCcw className="h-3 w-3" /> Reset
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
