// OpenPay AI — text to speech via Lovable AI
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CHARS = 4000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI voice is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text, voice, speed } = await req.json().catch(() => ({}));
    const input = typeof text === "string" ? text.trim().slice(0, MAX_CHARS) : "";
    if (!input) {
      return new Response(JSON.stringify({ error: "No text to speak" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input,
        voice: typeof voice === "string" && voice ? voice : "alloy",
        response_format: "mp3",
        speed: typeof speed === "number" ? speed : 1,
        instructions:
          "You are OpenPay's friendly financial assistant. Speak clearly, warmly and confidently at a natural pace. Read amounts and currencies precisely.",
      }),
    });

    if (!res.ok) {
      const details = await res.text().catch(() => "");
      console.error(`Lovable AI TTS failed [${res.status}]: ${details}`);
      const message =
        res.status === 429
          ? "Voice service is busy, please try again in a moment."
          : res.status === 402
            ? "AI credits exhausted. Add credits to keep using AI voice."
            : "Could not generate audio right now.";
      return new Response(JSON.stringify({ error: message, status: res.status, details }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audio = await res.arrayBuffer();
    return new Response(audio, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("ai-speech error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
