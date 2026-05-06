// Batch transcription endpoint — used by the Chrome extension popup which
// records via MediaRecorder and POSTs the resulting blob here.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY missing");

    const inForm = await req.formData();
    const file = inForm.get("file");
    if (!(file instanceof File) && !(file instanceof Blob)) {
      throw new Error("missing 'file' form field");
    }

    const out = new FormData();
    out.append("file", file, "audio.webm");
    out.append("model_id", "scribe_v2");
    const lang = inForm.get("language_code");
    if (typeof lang === "string" && lang) out.append("language_code", lang);

    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: out,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Transcribe failed [${res.status}]: ${text}`);
    }
    const data = await res.json();
    return new Response(JSON.stringify({ text: data.text ?? "", words: data.words ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error(msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
