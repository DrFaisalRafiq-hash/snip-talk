import { supabase } from "@/integrations/supabase/client";

export type ClipSource = "manual" | "dictation" | "snippet";

/**
 * Records a clipboard copy event in clipboard_history.
 * Best-effort — failures are logged but never thrown to the caller.
 * Skips empty / huge / duplicate-of-most-recent entries.
 */
export async function recordClipboard(
  userId: string,
  content: string,
  source: ClipSource = "manual"
) {
  const text = (content ?? "").trim();
  if (!text || text.length > 20_000) return;

  try {
    // Avoid duplicating the most recent entry for the same content
    const { data: latest } = await supabase
      .from("clipboard_history")
      .select("id, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (latest?.[0]?.content === text) return;

    await supabase
      .from("clipboard_history")
      .insert({ user_id: userId, content: text, source });
  } catch (e) {
    console.warn("clipboard history insert failed", e);
  }
}

/** Copies text to the OS clipboard AND records it in history. */
export async function copyAndRecord(
  userId: string,
  content: string,
  source: ClipSource = "manual"
) {
  await navigator.clipboard.writeText(content);
  await recordClipboard(userId, content, source);
}
