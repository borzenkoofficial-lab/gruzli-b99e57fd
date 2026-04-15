import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, jobs } = await req.json();
    if (!query || !jobs || !Array.isArray(jobs)) {
      return new Response(JSON.stringify({ error: "Нужен запрос и список заявок" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const jobsList = jobs.map((j: any) => 
      `ID: ${j.id} | "${j.title}" | ${j.description || "нет описания"} | ${j.address || "без адреса"} | ${j.metro || ""} | ${j.hourly_rate} ₽/ч | ${j.urgent ? "СРОЧНО" : ""} | ${j.start_time ? new Date(j.start_time).toLocaleString("ru-RU") : "без даты"}`
    ).join("\n");

    const prompt = `Запрос грузчика: "${query}"

Доступные заявки:
${jobsList}

Верни ID подходящих заявок, отсортированных по релевантности.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Ты — умный поиск заявок для грузчиков. Анализируй запрос пользователя и находи подходящие заявки из списка. Учитывай смысл, время, место, оплату. Если ничего не подходит — верни пустой массив.",
          },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_matching_jobs",
              description: "Return IDs of matching jobs sorted by relevance",
              parameters: {
                type: "object",
                properties: {
                  job_ids: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of job IDs sorted by relevance",
                  },
                },
                required: ["job_ids"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_matching_jobs" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Слишком много запросов" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Недостаточно кредитов AI" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let jobIds: string[] = [];
    
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        jobIds = args.job_ids || [];
      } catch {
        console.error("Failed to parse tool call arguments");
      }
    }

    return new Response(JSON.stringify({ job_ids: jobIds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart-search-jobs error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
