import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Ты — бот техподдержки приложения Gruzli. Gruzli — мобильное приложение для грузчиков и диспетчеров.

ВОЗМОЖНОСТИ ПРИЛОЖЕНИЯ:
- Лента заявок: грузчики видят доступные заявки, могут откликнуться
- Создание заявок: диспетчеры создают заявки с адресом, ставкой, описанием
- Чаты: личные и групповые, голосовые сообщения, фото
- Картотека: реестр пользователей для безопасности
- Профиль: редактирование данных, навыки, рейтинг
- Премиум: приоритет в откликах, бейдж
- AI-поиск: умный поиск заявок через нейросеть
- AI-модерация: автоматическая проверка контента
- Уведомления: push и email о новых заявках
- Кабинет диспетчера: статистика, управление заявками, AI-советы

ПРАВИЛА:
1. Отвечай кратко, по делу, на русском языке
2. Будь дружелюбным и профессиональным
3. Если вопрос про баги, сбои, оплату, или ты НЕ МОЖЕШЬ решить проблему — в конце ответа добавь РОВНО эту строку: [NEED_HUMAN]
4. Если можешь помочь сам — НЕ добавляй [NEED_HUMAN]
5. Не выдумывай функции, которых нет`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.slice(-20), // keep context manageable
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Слишком много запросов, попробуйте позже" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Сервис временно недоступен" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(
        JSON.stringify({ error: "AI error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("support-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
