// Live microphone permission state.
// Probes once on mount and re-fires whenever the user toggles the permission
// in the OS or browser settings (via the Permissions API change event).

import { useEffect, useState } from "react";
import { queryMicPermission, type MicPermissionState } from "@/lib/mic";

type PermissionStatusLike = {
  state: PermissionState;
  onchange: ((this: PermissionStatus, ev: Event) => unknown) | null;
};

export function useMicPermission(): MicPermissionState {
  const [state, setState] = useState<MicPermissionState>("unknown");

  useEffect(() => {
    let cancelled = false;
    queryMicPermission().then((s) => {
      if (!cancelled) setState(s);
    });

    let status: PermissionStatusLike | undefined;
    const perms = (navigator as Navigator & {
      permissions?: { query?: (q: { name: PermissionName }) => Promise<PermissionStatusLike> };
    }).permissions;
    perms?.query?.({ name: "microphone" as PermissionName })
      ?.then((s) => {
        if (cancelled) return;
        status = s;
        s.onchange = () => setState(s.state as MicPermissionState);
      })
      .catch(() => {
        /* Safari throws for unsupported names — best-effort only */
      });

    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, []);

  return state;
}
