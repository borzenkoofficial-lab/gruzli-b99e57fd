import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

const WEB_APP_URL = 'https://gruzli.lovable.app/';
const WELCOME_TEXT =
  '👋 <b>Привет!</b> Вы подписались на уведомления Грузли.\n\n' +
  'Здесь будут приходить новые заявки на грузчиков. Чтобы откликнуться — нажимайте кнопку под заявкой.\n\n' +
  '👇 Откройте приложение, чтобы посмотреть все заявки и свой профиль.';

// Match a code anywhere in the text (8 chars from the allowed alphabet)
const CODE_RE = /\b([ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8})\b/;

async function sendTelegram(
  apiKey: string,
  connectionKey: string,
  chatId: number,
  text: string,
  extra: Record<string, unknown> = {},
) {
  try {
    await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Connection-Api-Key': connectionKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...extra,
      }),
    });
  } catch (e) {
    console.error('[telegram-poll] sendMessage failed:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY || !supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Missing configuration' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: state, error: stateErr } = await supabase
    .from('telegram_bot_state')
    .select('update_offset')
    .eq('id', 1)
    .single();

  if (stateErr) {
    console.error('[telegram-poll] state read error:', stateErr.message);
    return new Response(JSON.stringify({ error: stateErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let currentOffset: number = state.update_offset;
  let totalProcessed = 0;
  let newSubscribers = 0;
  let newChannels = 0;

  while (true) {
    const elapsed = Date.now() - startTime;
    const remainingMs = MAX_RUNTIME_MS - elapsed;
    if (remainingMs < MIN_REMAINING_MS) break;

    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    const response = await fetch(`${GATEWAY_URL}/getUpdates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TELEGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        offset: currentOffset,
        timeout,
        allowed_updates: ['message', 'channel_post', 'my_chat_member'],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[telegram-poll] getUpdates failed:', data);
      return new Response(JSON.stringify({ error: data }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const updates = data.result ?? [];
    if (updates.length === 0) continue;

    for (const u of updates) {
      // ============ Handle bot being added/removed from chat ============
      if (u.my_chat_member) {
        const m = u.my_chat_member;
        const chat = m.chat;
        const newStatus: string = m.new_chat_member?.status ?? '';
        const isBroadcast = chat?.type === 'channel' || chat?.type === 'group' || chat?.type === 'supergroup';
        const removed = newStatus === 'left' || newStatus === 'kicked';

        if (isBroadcast && removed) {
          await supabase
            .from('telegram_user_channels')
            .update({ is_active: false })
            .eq('chat_id', chat.id);
          console.log(`[telegram-poll] Bot removed from ${chat.type} ${chat.id}, deactivated`);
        }

        if (isBroadcast && (newStatus === 'administrator' || newStatus === 'member')) {
          console.log(`[telegram-poll] Bot added to ${chat.type} ${chat.id} (${chat.title ?? ''})`);
        }
        totalProcessed++;
        continue;
      }

      // Helper for linking a chat (channel or group) via code
      const tryLinkChat = async (chat: any, text: string): Promise<boolean> => {
        const codeMatch = text.match(CODE_RE);
        if (!codeMatch) return false;
        const code = codeMatch[1];

        const { data: codeRow } = await supabase
          .from('telegram_link_codes')
          .select('user_id, expires_at, used_at, purpose')
          .eq('code', code)
          .maybeSingle();

        if (
          codeRow &&
          !codeRow.used_at &&
          new Date(codeRow.expires_at) > new Date() &&
          (codeRow.purpose === 'channel' || codeRow.purpose === 'personal')
        ) {
          const { error: chErr } = await supabase
            .from('telegram_user_channels')
            .upsert(
              {
                user_id: codeRow.user_id,
                chat_id: chat.id,
                title: chat.title ?? null,
                username: chat.username ?? null,
                is_active: true,
              },
              { onConflict: 'user_id,chat_id' },
            );

          if (chErr) {
            console.error('[telegram-poll] chat upsert error:', chErr.message);
            return false;
          }

          newChannels++;
          await supabase
            .from('telegram_link_codes')
            .update({ used_at: new Date().toISOString() })
            .eq('code', code);

          const label = chat.type === 'channel' ? 'Канал' : 'Группа';
          await sendTelegram(
            LOVABLE_API_KEY,
            TELEGRAM_API_KEY,
            chat.id,
            `✅ <b>${label} привязан${chat.type === 'channel' ? '' : 'а'} к Грузли!</b>\n\nТеперь все новые заявки будут публиковаться сюда автоматически.`,
          );
          return true;
        }

        await sendTelegram(
          LOVABLE_API_KEY,
          TELEGRAM_API_KEY,
          chat.id,
          '⚠️ Код недействителен или просрочен. Сгенерируйте новый код в приложении Грузли.',
        );
        return false;
      };

      // ============ Handle channel posts (for linking a channel) ============
      if (u.channel_post) {
        const post = u.channel_post;
        const chat = post.chat;
        if (!chat?.id || chat.type !== 'channel') continue;
        const text: string = (post.text ?? post.caption ?? '').trim();
        if (text) await tryLinkChat(chat, text);
        totalProcessed++;
        continue;
      }

      // ============ Handle messages (private + groups + supergroups) ============
      const msg = u.message;
      if (!msg?.chat?.id) continue;

      // Group / supergroup — only used for linking via code
      if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
        const text: string = (msg.text ?? msg.caption ?? '').trim();
        if (text) await tryLinkChat(msg.chat, text);
        totalProcessed++;
        continue;
      }

      const text: string = (msg.text ?? '').trim();
      const chatId: number = msg.chat.id;
      const isStart = text.toLowerCase().startsWith('/start');

      if (isStart) {
        const parts = text.split(/\s+/);
        const linkCode = parts.length > 1 ? parts[1].trim() : null;
        let linkedUserId: string | null = null;
        let linkSuccess = false;

        if (linkCode) {
          const { data: codeRow } = await supabase
            .from('telegram_link_codes')
            .select('user_id, expires_at, used_at, purpose')
            .eq('code', linkCode)
            .maybeSingle();

          if (
            codeRow &&
            !codeRow.used_at &&
            new Date(codeRow.expires_at) > new Date() &&
            codeRow.purpose !== 'channel'
          ) {
            linkedUserId = codeRow.user_id;
            linkSuccess = true;
            await supabase
              .from('telegram_link_codes')
              .update({ used_at: new Date().toISOString() })
              .eq('code', linkCode);
          }
        }

        const subRow: Record<string, unknown> = {
          chat_id: chatId,
          username: msg.from?.username ?? null,
          first_name: msg.from?.first_name ?? null,
          last_name: msg.from?.last_name ?? null,
          is_active: true,
        };
        if (linkedUserId) subRow.user_id = linkedUserId;

        const { error: upsertErr } = await supabase
          .from('telegram_subscribers')
          .upsert(subRow, { onConflict: 'chat_id' });

        if (upsertErr) {
          console.error('[telegram-poll] subscriber upsert error:', upsertErr.message);
        } else {
          newSubscribers++;
        }

        const greetingText = linkSuccess
          ? '✅ <b>Аккаунт привязан!</b>\n\nТеперь личные уведомления (новые сообщения, отклики, статусы заявок) будут приходить вам в Telegram.\n\n👇 Откройте приложение, чтобы продолжить работу.'
          : WELCOME_TEXT;

        await sendTelegram(LOVABLE_API_KEY, TELEGRAM_API_KEY, chatId, greetingText, {
          reply_markup: {
            inline_keyboard: [[
              { text: '🚀 Открыть приложение', web_app: { url: WEB_APP_URL } },
            ]],
          },
        });
      }

      totalProcessed++;
    }

    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    const { error: offsetErr } = await supabase
      .from('telegram_bot_state')
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (offsetErr) {
      console.error('[telegram-poll] offset update error:', offsetErr.message);
      return new Response(JSON.stringify({ error: offsetErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    currentOffset = newOffset;
  }

  return new Response(
    JSON.stringify({ ok: true, processed: totalProcessed, newSubscribers, newChannels, finalOffset: currentOffset }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
