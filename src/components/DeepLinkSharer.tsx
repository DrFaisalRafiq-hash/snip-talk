import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Link2, Copy, Check, Mic, FileText } from "lucide-react";
import { toast } from "sonner";

type Target = "dictate" | "snippets" | "history";
type Mode = "" | "live" | "stop";
type Action = "" | "copy" | "clear";

function buildLink(target: Target, text: string, mode: Mode, action: Action) {
  const base = `sniptalk://${target}`;
  if (target !== "dictate") return base;
  const qs = new URLSearchParams();
  if (text.trim()) qs.set("text", text.trim());
  if (mode) qs.set("mode", mode);
  if (action) qs.set("action", action);
  const q = qs.toString();
  return q ? `${base}?${q}` : base;
}

export function DeepLinkSharer() {
  const [target, setTarget] = useState<Target>("dictate");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const link = buildLink(target, text);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Link2 className="h-3.5 w-3.5" />
          Share link
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4 space-y-3">
        <div>
          <p className="font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            Target
          </p>
          <div className="inline-flex bg-muted rounded-full p-0.5 w-full">
            <button
              type="button"
              onClick={() => setTarget("dictate")}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs transition ${
                target === "dictate"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground"
              }`}
            >
              <Mic className="h-3 w-3" /> Dictate
            </button>
            <button
              type="button"
              onClick={() => setTarget("snippets")}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs transition ${
                target === "snippets"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground"
              }`}
            >
              <FileText className="h-3 w-3" /> Snippets
            </button>
          </div>
        </div>

        {target === "dictate" && (
          <div>
            <p className="font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Prefill text (optional)
            </p>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Hello from a deep link…"
              className="h-9 text-sm"
            />
          </div>
        )}

        <div>
          <p className="font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            Generated link
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border bg-background/60 px-2 py-1.5 text-xs">
              {link}
            </code>
            <Button size="icon" variant="outline" onClick={copy} className="h-8 w-8 shrink-0">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <a
            href={link}
            className="mt-2 inline-block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Test open
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
