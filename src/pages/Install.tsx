import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ArrowLeft, Share, Plus, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

const Install = () => {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const triggerInstall = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
  };

  return (
    <div className="min-h-screen bg-background paper-grain">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Logo size={22} animate />
            <span className="font-serif-display text-lg">Snip Talk</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="font-mono-tight text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Install on your phone
          </p>
          <h1 className="font-serif-display text-5xl md:text-6xl tracking-tight mb-4">
            Snip Talk on your home screen.
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl">
            Add Snip Talk to your iPhone or Android home screen for one-tap dictation —
            no App Store, no install, just a bookmark that opens like a real app.
          </p>
        </div>

        {/* Tabs */}
        <div className="inline-flex bg-card border rounded-full p-1 mb-8">
          {(["ios", "android", "desktop"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`px-5 py-1.5 rounded-full text-sm font-mono-tight uppercase tracking-wider transition ${
                platform === p ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "ios" ? "iPhone" : p === "android" ? "Android" : "Desktop"}
            </button>
          ))}
        </div>

        {platform === "ios" && (
          <div className="bg-card border rounded-2xl p-8 shadow-[var(--shadow-paper)] space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Smartphone className="h-6 w-6" />
              <h2 className="font-serif-display text-2xl">Install on iPhone or iPad</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              iOS only allows installs from Safari — if you're in Chrome or another browser,
              copy this URL and open it in Safari first.
            </p>
            <ol className="space-y-4">
              <Step n={1}>Open this page in <strong>Safari</strong>.</Step>
              <Step n={2}>
                Tap the <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted">
                  <Share className="h-3.5 w-3.5" /> Share
                </span> button at the bottom of the screen.
              </Step>
              <Step n={3}>
                Scroll and tap <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted">
                  <Plus className="h-3.5 w-3.5" /> Add to Home Screen
                </span>.
              </Step>
              <Step n={4}>Tap <strong>Add</strong> in the top-right. Snip Talk now lives on your home screen.</Step>
            </ol>
          </div>
        )}

        {platform === "android" && (
          <div className="bg-card border rounded-2xl p-8 shadow-[var(--shadow-paper)] space-y-6">
            <h2 className="font-serif-display text-2xl mb-2">Install on Android</h2>
            {installPromptEvent ? (
              <Button onClick={triggerInstall} size="lg">
                Install Snip Talk
              </Button>
            ) : (
              <ol className="space-y-4">
                <Step n={1}>Open this page in <strong>Chrome</strong>.</Step>
                <Step n={2}>Tap the <strong>⋮ menu</strong> in the top-right.</Step>
                <Step n={3}>Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</Step>
                <Step n={4}>Tap <strong>Install</strong>.</Step>
              </ol>
            )}
          </div>
        )}

        {platform === "desktop" && (
          <div className="bg-card border rounded-2xl p-8 shadow-[var(--shadow-paper)] space-y-6">
            <h2 className="font-serif-display text-2xl mb-2">Install on desktop</h2>
            {installPromptEvent ? (
              <Button onClick={triggerInstall} size="lg">
                Install Snip Talk
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                In Chrome or Edge, look for the <strong>install icon</strong> at the right end of the
                address bar, or open the browser menu and choose <strong>Install Snip Talk</strong>.
                Prefer the native macOS app? Use the Apple icon in the top header.
              </p>
            )}
          </div>
        )}

        <div className="mt-8 text-center text-xs text-muted-foreground font-mono-tight uppercase tracking-widest">
          Tip — share this page → <code className="text-foreground">/install</code>
        </div>
      </main>
    </div>
  );
};

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="shrink-0 w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center font-mono-tight text-sm">
        {n}
      </span>
      <span className="pt-0.5 text-foreground/90">{children}</span>
    </li>
  );
}

export default Install;
