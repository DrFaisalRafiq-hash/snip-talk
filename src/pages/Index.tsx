import { useSession } from "@/hooks/useSession";
import { useDeepLink } from "@/hooks/useDeepLink";
import { Logo } from "@/components/Logo";
import Auth from "./Auth";
import { Dictation } from "@/components/Dictation";
import { Snippets } from "@/components/Snippets";
import { ClipboardHistory } from "@/components/ClipboardHistory";
import { DeepLinkSharer } from "@/components/DeepLinkSharer";
import { GlobalShortcutEditor } from "@/components/GlobalShortcutEditor";
import { MicrophoneStatus } from "@/components/MicrophoneStatus";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useRef, useState } from "react";

type Tab = "dictate" | "snippets" | "history";

const VALID_TABS: Tab[] = ["dictate", "snippets", "history"];

function tabFromHash(): Tab | null {
  const h = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  return (VALID_TABS as string[]).includes(h) ? (h as Tab) : null;
}

const Index = () => {
  const { session, loading } = useSession();
  const [tab, setTabState] = useState<Tab>(() => tabFromHash() ?? "dictate");
  const [dictatePrefill, setDictatePrefill] = useState<string | undefined>(undefined);
  const [dictateCommand, setDictateCommand] = useState<{
    nonce: number;
    mode?: "live" | "stop" | "toggle" | "pause" | "resume";
    action?: "copy" | "clear";
  }>({ nonce: 0 });

  // Keep tab + URL hash in sync so reloads land on the same tab.
  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    if (tabFromHash() !== t) {
      const url = `${window.location.pathname}${window.location.search}#${t}`;
      window.history.replaceState(null, "", url);
    }
  }, []);

  useEffect(() => {
    const onHash = () => {
      const t = tabFromHash();
      if (t) setTabState(t);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Strip the one-shot ?deeplink= param after we consume it so a reload
  // doesn't re-fire commands like mode=live.
  const consumedQuery = useRef(false);
  useEffect(() => {
    if (consumedQuery.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("deeplink")) {
      consumedQuery.current = true;
      params.delete("deeplink");
      const qs = params.toString();
      const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }
  }, []);

  useDeepLink(
    useCallback((link) => {
      if (link.target === "dictate") {
        const text = link.params.get("text");
        if (text) setDictatePrefill(text);
        const rawMode = link.params.get("mode")?.toLowerCase();
        const rawAction = link.params.get("action")?.toLowerCase();
        const mode =
          rawMode === "live" || rawMode === "stop" || rawMode === "toggle" || rawMode === "pause" || rawMode === "resume"
            ? rawMode
            : undefined;
        const action =
          rawAction === "copy" || rawAction === "clear" ? rawAction : undefined;
        if (mode || action) {
          setDictateCommand((c) => ({ nonce: c.nonce + 1, mode, action }));
        }
        setTab("dictate");
      } else if (link.target === "snippets") {
        setTab("snippets");
      } else if (link.target === "history") {
        setTab("history");
      }
    }, [setTab])
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
          <MicrophoneStatus />
          <DeepLinkSharer />
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

        {tab === "dictate" && (
          <Dictation
            userId={session.user.id}
            prefill={dictatePrefill}
            command={dictateCommand}
          />
        )}
        {tab === "snippets" && <Snippets userId={session.user.id} />}
        {tab === "history" && <ClipboardHistory userId={session.user.id} />}

        <div className="mt-6">
          <GlobalShortcutEditor />
        </div>

      </main>
    </div>
  );
};

export default Index;
