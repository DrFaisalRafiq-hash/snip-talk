// Rewrite/expand a piece of text into a chosen output style using Lovable AI.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Style id -> system prompt. Keep prompts on the server so we can iterate
// without shipping a new client build.
const STYLES: Record<string, { label: string; system: string }> = {
  "email-formal": {
    label: "Email · Formal",
    system:
      "Rewrite the user's draft as a polished, formal business email. Use a clear subject line on the first line prefixed with 'Subject: '. Use professional salutation and sign-off ('Best regards,'). Keep paragraphs short. Do NOT invent facts not present in the draft; if recipient or sender names are missing, use neutral placeholders like [Recipient] and [Your name]. Output only the email — no commentary.",
  },
  "email-concise": {
    label: "Email · Concise",
    system:
      "Rewrite the user's draft as a short, direct email — under 80 words. One subject line ('Subject: ...'), one or two short paragraphs, single sentence sign-off. Plain language, no filler, no apologies. Do NOT invent facts. Output only the email.",
  },
  "email-friendly": {
    label: "Email · Friendly",
    system:
      "Rewrite the user's draft as a warm, friendly email. Conversational tone, contractions are fine, light enthusiasm without being over the top. Include a 'Subject: ...' line. Sign off casually ('Thanks!', 'Cheers,'). Do NOT invent facts. Output only the email.",
  },
  instructions: {
    label: "Step-by-step instructions",
    system:
      "Convert the user's draft into clear, numbered step-by-step instructions. Each step is one short imperative sentence. Add a one-line intro stating the goal. If prerequisites are mentioned, list them under a 'You'll need:' bullet section before the steps. Output only the formatted instructions.",
  },
  bullets: {
    label: "Bullet summary",
    system:
      "Summarize the user's draft as 3–7 tight bullet points. Lead each bullet with a strong noun or verb. No preamble, no closing line — just the bullets.",
  },
  meeting: {
    label: "Meeting notes",
    system:
      "Convert the user's draft into structured meeting notes with these sections (omit any that don't apply): 'Summary' (1–2 sentences), 'Decisions', 'Action items' (each prefixed with an owner if mentioned, otherwise '[ ]'), 'Open questions'. Use markdown headings.",
  },
  slack: {
    label: "Slack message",
    system:
      "Rewrite the user's draft as a Slack message. Friendly, scannable, 1–3 short paragraphs max. You may use a single relevant emoji at the start. No subject line. Use markdown bold/italics sparingly. Output only the message.",
  },
  polish: {
    label: "Polish (keep meaning)",
    system:
      "Lightly edit the user's draft for grammar, clarity, and flow. Preserve the original meaning, voice, and approximate length. Do NOT add new information or change tone. Output only the edited text.",
  },
  expand: {
    label: "Expand into prose",
    system:
      "Expand the user's terse draft into a well-structured paragraph or two of natural prose. Fill in obvious connective tissue, but do NOT invent facts, names, numbers, or events that are not implied by the draft. Output only the expanded text.",
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const styleId = typeof body?.style === "string" ? body.style : "polish";
    const extraInstructions =
      typeof body?.instructions === "string" ? body.instructions.trim().slice(0, 500) : "";

    if (!text) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text.length > 8000) {
      return new Response(JSON.stringify({ error: "text too long (max 8000 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const style = STYLES[styleId] ?? STYLES.polish;

    const systemPrompt = extraInstructions
      ? `${style.system}\n\nAdditional instructions from the user (apply if not in conflict with the above): ${extraInstructions}`
      : style.system;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit reached, please try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace → Usage." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const output: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
    return new Response(
      JSON.stringify({ output, style: styleId, label: style.label }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("expand-text error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
