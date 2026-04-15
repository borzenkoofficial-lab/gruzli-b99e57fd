import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, type } = await req.json();
    if (!text || !type) {
      return new Response(JSON.stringify({ error: "Нужен текст и тип" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const contextLabel = type === "job" ? "описание заявки на работу грузчиком" : "сообщение в чате между диспетчером и грузчиком";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Ты — модератор контента в приложении для грузчиков. Проверяй ${contextLabel} на: спам, мат, оскорбления, мошенничество, подозрительные ссылки, просьбы перевести деньги на карту, номера карт. Обычная рабочая лексика (адреса, суммы, время) — допустима.`,
          },
          { role: "user", content: `Проверь этот текст:\n"${text}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "moderation_result",
              description: "Return moderation verdict",
              parameters: {
                type: "object",
                properties: {
                  safe: { type: "boolean", description: "true if content is safe" },
                  reason: { type: "string", description: "Reason if not safe, in Russian" },
                },
                required: ["safe"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "moderation_result" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429 || response.status === 402) {
        // On rate limit/credits issue, allow content through
        return new Response(JSON.stringify({ safe: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      // On error, allow content through (fail-open)
      return new Response(JSON.stringify({ safe: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let result = { safe: true, reason: undefined as string | undefined };

    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch {
        console.error("Failed to parse moderation result");
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("moderate-content error:", e);
    // Fail-open: allow content on error
    return new Response(JSON.stringify({ safe: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
