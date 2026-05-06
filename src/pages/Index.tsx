import { useSession } from "@/hooks/useSession";
import { useDeepLink } from "@/hooks/useDeepLink";
import { Logo } from "@/components/Logo";
import Auth from "./Auth";
import { Dictation } from "@/components/Dictation";
import { Snippets } from "@/components/Snippets";
import { ClipboardHistory } from "@/components/ClipboardHistory";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useState } from "react";

type Tab = "dictate" | "snippets" | "history";

const Index = () => {
  const { session, loading } = useSession();
  const [tab, setTab] = useState<Tab>("dictate");
  const [dictatePrefill, setDictatePrefill] = useState<string | undefined>(undefined);

  useDeepLink(
    useCallback((link) => {
      if (link.target === "dictate") {
        const text = link.params.get("text");
        // Force a new reference even when the same text arrives twice in a row
        if (text) setDictatePrefill(text);
        setTab("dictate");
      } else if (link.target === "snippets") {
        setTab("snippets");
      }
    }, [])
  );

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">…</div>;
  }
  if (!session) return <Auth />;

  return (
    <div className="min-h-screen bg-background paper-grain">
      {/* Mac titlebar */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Logo size={22} animate />
            <span className="font-serif-display text-lg">Snip Talk</span>
          </div>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                const res = await fetch("/snip-talk-extension.zip");
                if (!res.ok) throw new Error(`Download failed (${res.status})`);
                const blob = await res.blob();
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "snip-talk-extension.zip";
                a.click();
                URL.revokeObjectURL(a.href);
              } catch (e) {
                console.error(e);
              }
            }}
          >
            Chrome extension
          </Button>
          <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
            Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-serif-display text-5xl md:text-6xl tracking-tight">
            Speak it. Save it. Reuse it.
          </h1>
          <p className="text-muted-foreground mt-3 max-w-xl">
            Live dictation powered by ElevenLabs with a tidy library of text snippets that sync to every device.
          </p>
        </div>

        <div className="inline-flex bg-card border rounded-full p-1 mb-6">
          {(["dictate", "snippets", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-1.5 rounded-full text-sm font-mono-tight uppercase tracking-wider transition ${
                tab === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "dictate" && <Dictation userId={session.user.id} />}
        {tab === "snippets" && <Snippets userId={session.user.id} />}
        {tab === "history" && <ClipboardHistory userId={session.user.id} />}

      </main>
    </div>
  );
};

export default Index;
