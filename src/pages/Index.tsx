import { useSession } from "@/hooks/useSession";
import { useDeepLink } from "@/hooks/useDeepLink";
import { Logo } from "@/components/Logo";
import Auth from "./Auth";
import { Dictation } from "@/components/Dictation";
import { Snippets } from "@/components/Snippets";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useState } from "react";

const Index = () => {
  const { session, loading } = useSession();
  const [tab, setTab] = useState<"dictate" | "snippets">("dictate");

  useDeepLink(
    useCallback((link) => {
      if (link.target === "dictate" || link.target === "snippets") {
        setTab(link.target);
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
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="traffic-dot bg-[#ff5f57]" />
            <span className="traffic-dot bg-[#febc2e]" />
            <span className="traffic-dot bg-[#28c840]" />
          </div>
          <div className="flex-1 flex items-center justify-center gap-2">
            <Logo size={22} />
            <span className="font-serif-display text-lg">Snip Talk</span>
          </div>
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
          {(["dictate", "snippets"] as const).map((t) => (
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

        {tab === "dictate" ? <Dictation /> : <Snippets userId={session.user.id} />}

        <footer className="mt-12 text-center text-xs text-muted-foreground font-mono-tight uppercase tracking-widest">
          Installable as a Mac app · PWA · Electron-ready
        </footer>
      </main>
    </div>
  );
};

export default Index;
