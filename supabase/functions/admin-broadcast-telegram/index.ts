import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

interface SendOpts {
  chatId: number;
  text: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  lovableKey: string;
  telegramKey: string;
}

async function sendOne(opts: SendOpts): Promise<{ ok: boolean; error?: any }> {
  const { chatId, text, imageUrl, linkUrl, linkLabel, lovableKey, telegramKey } = opts;

  const replyMarkup =
    linkUrl && linkLabel
      ? { inline_keyboard: [[{ text: linkLabel, url: linkUrl }]] }
      : undefined;

  const endpoint = imageUrl ? '/sendPhoto' : '/sendMessage';
  const body: Record<string, unknown> = imageUrl
    ? {
        chat_id: chatId,
        photo: imageUrl,
        caption: text,
        parse_mode: 'HTML',
      }
    : {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      };

  if (replyMarkup) body.reply_markup = replyMarkup;

  const resp = await fetch(`${GATEWAY_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': telegramKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return { ok: false, error: data };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY || !supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'Missing configuration' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify admin via auth header
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: isAdminRow, error: isAdminErr } = await admin.rpc('is_admin', { _user_id: userId });
  if (isAdminErr || !isAdminRow) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const text: string = String(payload.text || '').trim();
  const imageUrl: string | null = payload.image_url || null;
  const linkUrl: string | null = payload.link_url || null;
  const linkLabel: string | null = payload.link_label || null;
  const targetPersonal: boolean = Boolean(payload.target_personal);
  const targetChannels: boolean = Boolean(payload.target_channels);

  if (!text && !imageUrl) {
    return new Response(JSON.stringify({ error: 'Нужен текст или картинка' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!targetPersonal && !targetChannels) {
    return new Response(JSON.stringify({ error: 'Выберите хотя бы одну аудиторию' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (linkUrl && !/^https?:\/\//i.test(linkUrl)) {
    return new Response(JSON.stringify({ error: 'Ссылка должна начинаться с http:// или https://' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Collect chat IDs
  const chatIds: number[] = [];
  if (targetPersonal) {
    const { data: subs } = await admin
      .from('telegram_subscribers')
      .select('chat_id')
      .eq('is_active', true);
    for (const s of subs || []) if (s.chat_id) chatIds.push(Number(s.chat_id));
  }
  if (targetChannels) {
    const { data: chans } = await admin
      .from('telegram_user_channels')
      .select('chat_id')
      .eq('is_active', true);
    for (const c of chans || []) if (c.chat_id) chatIds.push(Number(c.chat_id));
  }

  // Dedupe
  const uniqueChats = Array.from(new Set(chatIds));

  // Insert broadcast row
  const { data: bRow, error: bErr } = await admin
    .from('broadcasts')
    .insert({
      created_by: userId,
      text,
      link_url: linkUrl,
      link_label: linkLabel,
      image_url: imageUrl,
      target_personal: targetPersonal,
      target_channels: targetChannels,
      total_targets: uniqueChats.length,
      status: 'sending',
    })
    .select()
    .single();

  if (bErr || !bRow) {
    return new Response(JSON.stringify({ error: bErr?.message || 'Не удалось создать рассылку' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const safeText = escapeHtml(text);
  let sent = 0;
  let failed = 0;
  const deactivateChats: number[] = [];

  for (const chatId of uniqueChats) {
    const result = await sendOne({
      chatId,
      text: safeText,
      imageUrl,
      linkUrl,
      linkLabel,
      lovableKey: LOVABLE_API_KEY,
      telegramKey: TELEGRAM_API_KEY,
    });
    if (result.ok) sent++;
    else {
      failed++;
      const code = (result.error as any)?.error_code;
      if (code === 403 || code === 400) deactivateChats.push(chatId);
    }
    // Telegram rate limit: ~30 msg/sec for broadcasts. Sleep 50ms ~ 20/sec to be safe.
    await new Promise((r) => setTimeout(r, 50));
  }

  // Mark blocked chats inactive
  if (deactivateChats.length > 0) {
    await admin
      .from('telegram_subscribers')
      .update({ is_active: false })
      .in('chat_id', deactivateChats);
    await admin
      .from('telegram_user_channels')
      .update({ is_active: false })
      .in('chat_id', deactivateChats);
  }

  await admin
    .from('broadcasts')
    .update({
      status: failed === uniqueChats.length && uniqueChats.length > 0 ? 'failed' : 'sent',
      sent_count: sent,
      failed_count: failed,
      finished_at: new Date().toISOString(),
    })
    .eq('id', bRow.id);

  return new Response(
    JSON.stringify({
      ok: true,
      broadcast_id: bRow.id,
      total: uniqueChats.length,
      sent,
      failed,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
