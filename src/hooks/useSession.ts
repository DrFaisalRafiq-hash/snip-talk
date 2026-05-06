import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isAllowedEmail } from "@/lib/allowlist";
import { toast } from "sonner";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apply = async (s: Session | null) => {
      if (s && !isAllowedEmail(s.user.email)) {
        toast.error("This account isn't authorized for Snip Talk.");
        await supabase.auth.signOut();
        setSession(null);
      } else {
        setSession(s);
      }
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => apply(s));
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
