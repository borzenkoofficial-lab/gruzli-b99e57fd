const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const CHAT_ID = 6518626060;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmtDate(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    });
  } catch {
    return iso;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');

  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Telegram credentials not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const payload = await req.json();
    const job = payload?.record ?? payload?.job ?? payload;

    if (!job?.id) {
      return new Response(JSON.stringify({ error: 'No job data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Skip bot-generated jobs
    if (job.is_bot === true) {
      console.log(`[telegram] Skipping bot job ${job.id}`);
      return new Response(JSON.stringify({ skipped: 'bot job' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lines: string[] = ['🚛 <b>НОВАЯ ЗАЯВКА</b>', ''];

    if (job.title) lines.push(`<b>📋 Название:</b> ${escapeHtml(String(job.title))}`);
    if (job.description) lines.push(`<b>📝 Описание:</b> ${escapeHtml(String(job.description))}`);

    const start = fmtDate(job.start_time);
    if (start) lines.push(`<b>🕐 Начало:</b> ${escapeHtml(start)}`);

    if (job.duration_hours) lines.push(`<b>⏱ Длительность:</b> ${job.duration_hours} ч`);
    if (job.workers_needed) lines.push(`<b>👥 Сколько человек:</b> ${job.workers_needed}`);
    if (job.address) lines.push(`<b>📍 Адрес:</b> ${escapeHtml(String(job.address))}`);
    if (job.metro) lines.push(`<b>🚇 Метро:</b> ${escapeHtml(String(job.metro))}`);
    if (job.hourly_rate) lines.push(`<b>💰 Цена:</b> ${job.hourly_rate} ₽/час`);

    const tags: string[] = [];
    if (job.urgent) tags.push('⚡ Срочно');
    if (job.quick_minimum) tags.push('⏰ Быстрая минималка');
    if (tags.length) {
      lines.push('');
      lines.push(tags.join(' · '));
    }

    const text = lines.join('\n');

    const webAppUrl = `https://gruzli.lovable.app/?job=${encodeURIComponent(job.id)}`;

    const body = {
      chat_id: CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[
          { text: 'Откликнуться в приложении', web_app: { url: webAppUrl } },
        ]],
      },
    };

    console.log(`[telegram] Sending job ${job.id} to chat ${CHAT_ID}`);

    const response = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TELEGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[telegram] Send failed [${response.status}]:`, data);
      return new Response(
        JSON.stringify({ error: 'Telegram send failed', details: data }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`[telegram] Sent successfully, message_id=${data?.result?.message_id}`);

    return new Response(
      JSON.stringify({ ok: true, message_id: data?.result?.message_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[telegram] Error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
