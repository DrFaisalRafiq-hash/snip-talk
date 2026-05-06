import { Logo } from "@/components/Logo";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ALLOWED_EMAILS } from "@/lib/allowlist";

export default function Auth() {
  const ownerEmail = ALLOWED_EMAILS[0];

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: {
        login_hint: ownerEmail,
        prompt: "select_account",
      },
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background paper-grain px-6">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center flex flex-col items-center">
          <Logo size={88} animate />
          <h1 className="font-serif-display text-6xl tracking-tight mt-4">Snip Talk</h1>
          <p className="text-muted-foreground mt-2 font-mono-tight text-xs uppercase tracking-widest">
            Dictate · Capture · Reuse
          </p>
        </div>

        <div className="space-y-5 bg-card rounded-2xl p-8 border shadow-[var(--shadow-paper)]">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Private workspace — sign in with
            </p>
            <p className="font-mono-tight text-sm mt-1">{ownerEmail}</p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 h-11"
            onClick={handleGoogle}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2 1.5-4.6 2.4-7.3 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.5 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2C40.9 35.4 44 30.1 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continue with Google
          </Button>

          <p className="text-[10px] text-center uppercase tracking-widest text-muted-foreground font-mono-tight">
            Other accounts will be denied access
          </p>
        </div>
      </div>
    </div>
  );
}
