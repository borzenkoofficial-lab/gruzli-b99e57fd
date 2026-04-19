import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const WEB_APP_URL = 'https://gruzli.lovable.app/';

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildMessage(payload: any): { text: string; url?: string; buttonText?: string } {
  switch (payload.type) {
    case 'new_message':
      return {
        text:
          `💬 <b>Новое сообщение</b>\n\n` +
          `От: <b>${escapeHtml(payload.sender_name)}</b>\n` +
          `${escapeHtml(payload.preview)}`,
        url: `${WEB_APP_URL}?chat=${encodeURIComponent(payload.conversation_id)}`,
        buttonText: 'Открыть чат',
      };
    case 'new_response':
      return {
        text:
          `🙋 <b>Новый отклик на заявку</b>\n\n` +
          `<b>${escapeHtml(payload.job_title)}</b>\n` +
          `Откликнулся: <b>${escapeHtml(payload.worker_name)}</b>`,
        url: `${WEB_APP_URL}?job=${encodeURIComponent(payload.job_id)}`,
        buttonText: 'Посмотреть отклик',
      };
    case 'status_change': {
      const labels: Record<string, string> = {
        accepted: '✅ Отклик принят',
        rejected: '❌ Отклик отклонён',
        in_progress: '🚀 Работа начата',
        completed: '🏁 Работа завершена',
        cancelled: '🚫 Работа отменена',
      };
      const status = labels[payload.worker_status] ?? `Статус: ${payload.worker_status}`;
      return {
        text: `${status}\n\n<b>${escapeHtml(payload.job_title || '')}</b>`,
        url: `${WEB_APP_URL}?job=${encodeURIComponent(payload.job_id)}`,
        buttonText: 'Открыть заявку',
      };
    }
    case 'new_job':
      return {
        text:
          `🚛 <b>Новая заявка</b>\n\n` +
          `<b>${escapeHtml(payload.job_title)}</b>\n` +
          (payload.address ? `📍 ${escapeHtml(payload.address)}\n` : '') +
          (payload.hourly_rate ? `💰 ${payload.hourly_rate} ₽/час` : ''),
        url: `${WEB_APP_URL}?job=${encodeURIComponent(payload.job_id)}`,
        buttonText: 'Откликнуться',
      };
    default:
      return { text: `🔔 ${escapeHtml(JSON.stringify(payload))}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY || !supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Missing configuration' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = await req.json();
    const userId: string | undefined = payload.user_id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: sub, error } = await supabase
      .from('telegram_subscribers')
      .select('chat_id, is_active')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!sub || !sub.is_active) {
      return new Response(JSON.stringify({ skipped: 'not linked or inactive' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { text, url, buttonText } = buildMessage(payload);

    const body: Record<string, unknown> = {
      chat_id: sub.chat_id,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };

    if (url && buttonText) {
      body.reply_markup = {
        inline_keyboard: [[{ text: buttonText, web_app: { url } }]],
      };
    }

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
      // Mark as inactive if user blocked the bot
      if (data?.error_code === 403) {
        await supabase
          .from('telegram_subscribers')
          .update({ is_active: false })
          .eq('chat_id', sub.chat_id);
      }
      console.error(`[telegram-personal] send failed [${response.status}]:`, data);
      return new Response(JSON.stringify({ error: data }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, message_id: data?.result?.message_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[telegram-personal] error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
