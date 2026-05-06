// Microphone permission helper with macOS-aware messaging.
// macOS gates mic access at the OS level (System Settings → Privacy & Security → Microphone)
// in addition to the per-site/browser prompt, so we surface specific guidance.

export type MicPermissionState =
  | "unknown"
  | "prompt"
  | "granted"
  | "denied"
  | "unsupported";

export const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

export const isElectron =
  typeof navigator !== "undefined" &&
  /Electron/i.test(navigator.userAgent);

export async function queryMicPermission(): Promise<MicPermissionState> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "unsupported";
  }
  // Permissions API is the most reliable signal when available.
  const perms: any = (navigator as any).permissions;
  if (perms?.query) {
    try {
      const status = await perms.query({ name: "microphone" as PermissionName });
      return (status.state as MicPermissionState) ?? "unknown";
    } catch {
      // Safari throws for unsupported names.
    }
  }
  return "unknown";
}

export async function requestMicPermission(): Promise<{
  state: MicPermissionState;
  error?: string;
  stream?: MediaStream;
}> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { state: "unsupported", error: "Microphone API not available in this browser." };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    return { state: "granted", stream };
  } catch (err) {
    const e = err as DOMException;
    // Map common errors to denied/blocked states.
    const denied =
      e?.name === "NotAllowedError" ||
      e?.name === "SecurityError" ||
      e?.name === "PermissionDeniedError";
    return {
      state: denied ? "denied" : "unknown",
      error: e?.message || "Microphone request failed.",
    };
  }
}

export function micDeniedMessage(): { title: string; steps: string[] } {
  if (isElectron && isMac) {
    return {
      title: "Microphone access blocked by macOS",
      steps: [
        "Open System Settings → Privacy & Security → Microphone",
        "Enable Snip Talk in the list",
        "Quit Snip Talk completely and reopen it",
      ],
    };
  }
  if (isMac) {
    return {
      title: "Microphone access blocked",
      steps: [
        "Click the site/lock icon in the address bar and allow microphone",
        "If still blocked: System Settings → Privacy & Security → Microphone",
        "Enable your browser, then reload this page",
      ],
    };
  }
  return {
    title: "Microphone access blocked",
    steps: [
      "Click the lock icon in the address bar",
      "Set Microphone to “Allow”",
      "Reload the page",
    ],
  };
}
