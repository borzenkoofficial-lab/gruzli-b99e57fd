import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { stats } = await req.json();
    if (!stats) {
      return new Response(JSON.stringify({ error: "Нет данных статистики" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Статистика диспетчера грузчиков за последний период:
- Всего завершённых заказов: ${stats.totalJobs}
- За неделю: ${stats.weeklyJobs} заказов
- Средняя ставка грузчикам: ${stats.avgRate} ₽/час
- Недельный доход: ${stats.weeklyIncome} ₽
- Недельный расход: ${stats.weeklyExpense} ₽
- Недельная прибыль: ${stats.weeklyProfit} ₽
- Месячная прибыль: ${stats.monthlyProfit} ₽
- Активных заказов сейчас: ${stats.activeJobsCount}

Дай 3-5 конкретных персональных советов по улучшению работы диспетчера. Учитывай цифры.`;

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
            content: "Ты — AI-аналитик для диспетчеров грузчиков. Давай конкретные, короткие и полезные советы на русском. Каждый совет — 1-2 предложения. Нумеруй их. Не используй markdown-заголовки. Будь дружелюбным.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Слишком много запросов, попробуйте позже" }), {
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
    const advice = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ advice }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dispatcher-analytics error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
