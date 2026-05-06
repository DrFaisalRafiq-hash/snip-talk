import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, RotateCcw, Keyboard } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

const MODIFIER_KEYS = new Set(["Meta", "Control", "Shift", "Alt", "OS"]);
const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

function eventToAccelerator(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  const parts: string[] = [];
  if (e.metaKey) parts.push("CommandOrControl");
  else if (e.ctrlKey) parts.push("CommandOrControl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (!parts.length) return null;
  let key = e.key;
  if (key === " ") key = "Space";
  else if (key.length === 1) key = key.toUpperCase();
  parts.push(key);
  return parts.join("+");
}

function formatAccelerator(a: string): string {
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

export function GlobalShortcutEditor() {
  const supported = !!window.sniptalk?.setGlobalShortcut;
  const [current, setCurrent] = useState<string>("CommandOrControl+Shift+D");
  const [defaultAcc, setDefaultAcc] = useState<string>("CommandOrControl+Shift+D");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string>(current);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!supported) return;
    window.sniptalk!.getGlobalShortcut!().then((r) => {
      setCurrent(r.accelerator);
      setDefaultAcc(r.default);
      setDraft(r.accelerator);
    });
  }, [supported]);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const acc = eventToAccelerator(e);
      if (!acc) return;
      setDraft(acc);
      setRecording(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording]);

  if (!supported) return null;

  const save = async () => {
    const r = await window.sniptalk!.setGlobalShortcut!(draft);
    if (r.ok) {
      setCurrent(r.accelerator);
      toast.success(`Global shortcut: ${formatAccelerator(r.accelerator)}`);
      setOpen(false);
    } else {
      toast.error(`Couldn't register "${draft}" — try a different combo`);
    }
  };

  const reset = async () => {
    const r = await window.sniptalk!.setGlobalShortcut!(defaultAcc);
    if (r.ok) {
      setCurrent(r.accelerator);
      setDraft(r.accelerator);
      toast.success("Reset to default");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 w-full justify-between">
          <span className="flex items-center gap-1.5">
            <Keyboard className="h-3.5 w-3.5" />
            System shortcut
          </span>
          <span className="font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
            {formatAccelerator(current)}
            <Pencil className="h-2.5 w-2.5 opacity-60" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4 space-y-3">
        <div>
          <p className="font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            Toggle dictation system-wide
          </p>
          <div
            tabIndex={0}
            onClick={() => setRecording(true)}
            onBlur={() => setRecording(false)}
            className={`w-full cursor-text rounded-md border px-3 py-3 text-center font-mono-tight text-sm transition ${
              recording
                ? "border-foreground bg-foreground/5 animate-pulse"
                : "bg-background/60 hover:border-foreground/40"
            }`}
          >
            {recording ? "Press your shortcut…" : formatAccelerator(draft)}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Works even when Snip Talk isn't focused. Modifier required.
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
