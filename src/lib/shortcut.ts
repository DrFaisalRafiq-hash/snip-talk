import { useEffect, useState } from "react";

export type Shortcut = {
  /** Lowercase single key (a-z, 0-9, etc.) or symbol */
  key: string;
  meta: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
};

const DEFAULT_SHORTCUT: Shortcut = {
  key: "d",
  meta: typeof navigator !== "undefined" && /Mac/i.test(navigator.platform),
  ctrl: !(typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)),
  shift: true,
  alt: false,
};

const STORAGE_KEY = "snip-talk:dictation-shortcut";

export function loadShortcut(): Shortcut {
  if (typeof window === "undefined") return DEFAULT_SHORTCUT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SHORTCUT;
    const parsed = JSON.parse(raw) as Partial<Shortcut>;
    if (!parsed.key) return DEFAULT_SHORTCUT;
    return { ...DEFAULT_SHORTCUT, ...parsed, key: String(parsed.key).toLowerCase() };
  } catch {
    return DEFAULT_SHORTCUT;
  }
}

export function saveShortcut(s: Shortcut) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("snip-talk:shortcut-changed", { detail: s }));
}

export function resetShortcut() {
  saveShortcut(DEFAULT_SHORTCUT);
}

/** Subscribe to live shortcut updates. */
export function useShortcut() {
  const [shortcut, setShortcut] = useState<Shortcut>(() => loadShortcut());
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Shortcut>).detail;
      if (detail) setShortcut(detail);
      else setShortcut(loadShortcut());
    };
    const storage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setShortcut(loadShortcut());
    };
    window.addEventListener("snip-talk:shortcut-changed", handler);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("snip-talk:shortcut-changed", handler);
      window.removeEventListener("storage", storage);
    };
  }, []);
  return shortcut;
}

export function matchesShortcut(e: KeyboardEvent, s: Shortcut): boolean {
  if (s.meta !== e.metaKey) return false;
  if (s.ctrl !== e.ctrlKey) return false;
  if (s.shift !== e.shiftKey) return false;
  if (s.alt !== e.altKey) return false;
  return e.key.toLowerCase() === s.key.toLowerCase();
}

export function formatShortcut(s: Shortcut): string {
  const parts: string[] = [];
  if (s.meta) parts.push("⌘");
  if (s.ctrl) parts.push("Ctrl");
  if (s.alt) parts.push(/Mac/i.test(navigator.platform) ? "⌥" : "Alt");
  if (s.shift) parts.push("⇧");
  parts.push(s.key.length === 1 ? s.key.toUpperCase() : s.key);
  return parts.join("+");
}

const MODIFIER_KEYS = new Set(["Meta", "Control", "Shift", "Alt", "OS"]);

/** Capture the next keypress as a Shortcut (returns null if only modifiers pressed). */
export function shortcutFromEvent(e: KeyboardEvent): Shortcut | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  return {
    key: e.key.toLowerCase(),
    meta: e.metaKey,
    ctrl: e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey,
  };
}
