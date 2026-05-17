import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTgCtx, tg } from '../_shared/telegram/api.ts';
import { mainMenu, MENU_LABELS, WEB_APP_URL, type Role } from '../_shared/telegram/keyboards.ts';
import { clearFsm, getFsm, setFsm } from '../_shared/telegram/fsm.ts';
import { showAvailableJobs, respondToJob, showMyJobs, setWorkerStatus } from '../_shared/telegram/worker.ts';
import { startCreateJob, handleDispatcherFsm, handleDispatcherCallback, showDispatcherJobs } from '../_shared/telegram/dispatcher.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;
const CODE_RE = /\b([ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8})\b/;

const WELCOME_TEXT =
  '👋 <b>Привет!</b> Это бот Грузли — заявки и уведомления для грузчиков и диспетчеров.\n\n' +
  'Чтобы пользоваться кабинетом прямо здесь, привяжите аккаунт из приложения. Команда /menu всегда открывает меню.';

const HOWTO_LINK =
  '🔗 <b>Как привязать аккаунт</b>\n\n' +
  '1. Откройте приложение Грузли\n' +
  '2. Профиль → «Telegram»\n' +
  '3. Нажмите «Сгенерировать код»\n' +
  '4. Отправьте мне команду:\n<code>/start КОД</code>';

// ===== Role detection =====
async function getUserRole(sb: any, chatId: number): Promise<{ userId: string | null; role: Role }> {
  const { data: sub } = await sb
    .from('telegram_subscribers')
    .select('user_id')
    .eq('chat_id', chatId)
    .maybeSingle();
  if (!sub?.user_id) return { userId: null, role: null };
  const { data: roleRow } = await sb
    .from('user_roles')
    .select('role')
    .eq('user_id', sub.user_id)
    .maybeSingle();
  return { userId: sub.user_id, role: (roleRow?.role as Role) ?? 'worker' };
}

// ===== Show main menu =====
async function showMenu(ctx: any, sb: any, chatId: number, greeting?: string) {
  const { role } = await getUserRole(sb, chatId);
  const text = greeting
    ?? (role
      ? `📱 <b>Меню Грузли</b>\nРоль: <b>${role === 'dispatcher' ? 'Диспетчер' : role === 'admin' ? 'Админ' : 'Грузчик'}</b>`
      : WELCOME_TEXT);
  await tg.send(ctx, chatId, text, mainMenu(role));
}

// ===== Handlers =====
async function handleStart(ctx: any, sb: any, chatId: number, text: string, msgFrom: any) {
  const parts = text.split(/\s+/);
  const linkCode = parts.length > 1 ? parts[1].trim() : null;
  let linkedUserId: string | null = null;

  if (linkCode) {
    const { data: codeRow } = await sb
      .from('telegram_link_codes')
      .select('user_id, expires_at, used_at, purpose')
      .eq('code', linkCode)
      .maybeSingle();

    if (
      codeRow && !codeRow.used_at &&
      new Date(codeRow.expires_at) > new Date() &&
      codeRow.purpose !== 'channel'
    ) {
      linkedUserId = codeRow.user_id;
      await sb.from('telegram_link_codes').update({ used_at: new Date().toISOString() }).eq('code', linkCode);
    }
  }

  const subRow: Record<string, unknown> = {
    chat_id: chatId,
    username: msgFrom?.username ?? null,
    first_name: msgFrom?.first_name ?? null,
    last_name: msgFrom?.last_name ?? null,
    is_active: true,
  };
  if (linkedUserId) subRow.user_id = linkedUserId;
  await sb.from('telegram_subscribers').upsert(subRow, { onConflict: 'chat_id' });

  const greeting = linkedUserId
    ? '✅ <b>Аккаунт привязан!</b> Личные уведомления будут приходить сюда.\n\nВыберите действие в меню ниже.'
    : WELCOME_TEXT;
  await showMenu(ctx, sb, chatId, greeting);
}

async function handleSupport(ctx: any, sb: any, chatId: number) {
  const { userId } = await getUserRole(sb, chatId);
  if (!userId) return handleNotLinked(ctx, chatId);
  await tg.send(
    ctx,
    chatId,
    '🆘 <b>Поддержка Грузли</b>\n\nНажмите кнопку ниже — откроется чат с администрацией прямо в приложении. Ответим максимально быстро.',
    {
      reply_markup: {
        inline_keyboard: [[{ text: '💬 Открыть чат с поддержкой', web_app: { url: WEB_APP_URL + '?action=support' } }]],
      },
    },
  );
}

async function handleSettings(ctx: any, sb: any, chatId: number) {
  const { userId, role } = await getUserRole(sb, chatId);
  if (!userId) return handleNotLinked(ctx, chatId);

  const { data: sub } = await sb
    .from('telegram_subscribers')
    .select('username, first_name, last_name, is_active, created_at')
    .eq('chat_id', chatId)
    .maybeSingle();

  const roleLabel = role === 'dispatcher' ? 'Диспетчер' : role === 'admin' ? 'Админ' : 'Грузчик';
  const name = [sub?.first_name, sub?.last_name].filter(Boolean).join(' ') || sub?.username || '—';
  const linkedSince = sub?.created_at ? new Date(sub.created_at).toLocaleDateString('ru-RU') : '—';
  const notifStatus = sub?.is_active ? '🔔 Включены' : '🔕 Отключены';

  await tg.send(
    ctx,
    chatId,
    `⚙️ <b>Настройки</b>\n\n` +
      `👤 Аккаунт: <b>${name}</b>\n` +
      `🎭 Роль: <b>${roleLabel}</b>\n` +
      `🔗 Привязан с: <b>${linkedSince}</b>\n` +
      `Уведомления: <b>${notifStatus}</b>\n\n` +
      'Расширенные настройки профиля, навыков и приватности доступны в приложении.',
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: sub?.is_active ? '🔕 Отключить уведомления' : '🔔 Включить уведомления',
              callback_data: sub?.is_active ? 'settings:notif_off' : 'settings:notif_on',
            },
          ],
          [{ text: '⚙️ Открыть настройки в приложении', web_app: { url: WEB_APP_URL + '?action=settings' } }],
          [{ text: '🚪 Отвязать аккаунт', callback_data: 'settings:unlink_confirm' }],
        ],
      },
    },
  );
}

async function handleNotLinked(ctx: any, chatId: number) {
  await tg.send(ctx, chatId, '⚠️ Сначала привяжите аккаунт, чтобы пользоваться кабинетом.', {
    reply_markup: { inline_keyboard: [[{ text: '🔗 Как привязать', callback_data: 'auth:howto' }]] },
  });
}

async function handleStub(ctx: any, chatId: number, label: string) {
  await tg.send(
    ctx,
    chatId,
    `🧱 <b>${label}</b>\n\nЭтот раздел появится в боте на следующих этапах. Пока используйте приложение:`,
    { reply_markup: { inline_keyboard: [[{ text: MENU_LABELS.app, web_app: { url: WEB_APP_URL } }]] } },
  );
}

// ===== Tryto link channel/group =====
async function tryLinkChat(ctx: any, sb: any, chat: any, text: string): Promise<boolean> {
  const codeMatch = text.match(CODE_RE);
  if (!codeMatch) return false;
  const code = codeMatch[1];

  const { data: codeRow } = await sb
    .from('telegram_link_codes')
    .select('user_id, expires_at, used_at, purpose')
    .eq('code', code)
    .maybeSingle();

  if (
    codeRow && !codeRow.used_at &&
    new Date(codeRow.expires_at) > new Date() &&
    (codeRow.purpose === 'channel' || codeRow.purpose === 'personal')
  ) {
    await sb.from('telegram_user_channels').upsert(
      {
        user_id: codeRow.user_id,
        chat_id: chat.id,
        title: chat.title ?? null,
        username: chat.username ?? null,
        is_active: true,
      },
      { onConflict: 'user_id,chat_id' },
    );
    await sb.from('telegram_link_codes').update({ used_at: new Date().toISOString() }).eq('code', code);
    const label = chat.type === 'channel' ? 'Канал' : 'Группа';
    await tg.send(ctx, chat.id, `✅ <b>${label} привязан${chat.type === 'channel' ? '' : 'а'} к Грузли!</b>\n\nЗаявки будут публиковаться сюда автоматически.`);
    return true;
  }

  await tg.send(ctx, chat.id, '⚠️ Код недействителен или просрочен. Сгенерируйте новый код в приложении Грузли.');
  return false;
}

// ===== Main router =====
async function routeMessage(ctx: any, sb: any, msg: any) {
  const chatId: number = msg.chat.id;
  const text: string = (msg.text ?? '').trim();

  // groups / supergroups / channels — only linking
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    if (text) await tryLinkChat(ctx, sb, msg.chat, text);
    return;
  }

  // /start
  if (text.toLowerCase().startsWith('/start')) {
    await clearFsm(sb, chatId);
    await handleStart(ctx, sb, chatId, text, msg.from);
    return;
  }

  // /menu, /cancel
  if (text === '/menu' || text === MENU_LABELS.cancel || text.toLowerCase() === '/cancel') {
    await clearFsm(sb, chatId);
    await showMenu(ctx, sb, chatId);
    return;
  }

  // FSM state takes precedence
  const fsm = await getFsm(sb, chatId);
  if (fsm) {
    const { userId: fsmUser, role: fsmRole } = await getUserRole(sb, chatId);
    if (fsm.state.startsWith('dc:') && fsmUser && (fsmRole === 'dispatcher' || fsmRole === 'admin')) {
      const handled = await handleDispatcherFsm(ctx, sb, chatId, fsmUser, fsm, text);
      if (handled) return;
    }
    // unknown / stale state
    await clearFsm(sb, chatId);
    await showMenu(ctx, sb, chatId, '↩️ Сценарий сброшен.');
    return;
  }

  // Reply-keyboard buttons
  const { userId, role } = await getUserRole(sb, chatId);

  switch (text) {
    case MENU_LABELS.support:
      return handleSupport(ctx, chatId);
    case MENU_LABELS.settings:
      return handleStub(ctx, chatId, 'Настройки');
  }

  if (!userId) {
    if (text) await showMenu(ctx, sb, chatId);
    return;
  }

  // Worker buttons
  if (role === 'worker') {
    switch (text) {
      case MENU_LABELS.workerJobs: return showAvailableJobs(ctx, sb, chatId, userId, 0);
      case MENU_LABELS.workerMyJobs: return showMyJobs(ctx, sb, chatId, userId);
      case MENU_LABELS.workerBalance: {
        const { data: p } = await sb.from('profiles').select('balance, total_earned').eq('user_id', userId).maybeSingle();
        return tg.send(ctx, chatId, `💰 <b>Баланс</b>\n\nТекущий: <b>${p?.balance ?? 0} ₽</b>\nВсего заработано: <b>${p?.total_earned ?? 0} ₽</b>`);
      }
      case MENU_LABELS.workerRating: {
        const { data: p } = await sb.from('profiles').select('rating, completed_orders').eq('user_id', userId).maybeSingle();
        return tg.send(ctx, chatId, `⭐️ <b>Рейтинг</b>\n\nОценка: <b>${Number(p?.rating ?? 5).toFixed(2)}</b>\nВыполнено заказов: <b>${p?.completed_orders ?? 0}</b>`);
      }
    }
  }

  // Dispatcher / admin buttons
  if (role === 'dispatcher' || role === 'admin') {
    switch (text) {
      case MENU_LABELS.dispatcherCreate: return startCreateJob(ctx, sb, chatId, userId);
      case MENU_LABELS.dispatcherJobs: return showDispatcherJobs(ctx, sb, chatId, userId);
      case MENU_LABELS.dispatcherStats: {
        const { count: jobsCount } = await sb.from('jobs').select('*', { count: 'exact', head: true }).eq('dispatcher_id', userId);
        const { count: activeCount } = await sb.from('jobs').select('*', { count: 'exact', head: true }).eq('dispatcher_id', userId).eq('status', 'active');
        return tg.send(ctx, chatId, `📊 <b>Статистика</b>\n\nВсего заявок: <b>${jobsCount ?? 0}</b>\nАктивных: <b>${activeCount ?? 0}</b>\n\nПодробная аналитика — в кабинете приложения.`);
      }
      case MENU_LABELS.dispatcherBroadcast: return handleStub(ctx, chatId, 'Рассылка');
    }
  }

  // Anything else — show menu hint
  if (text && !text.startsWith('/')) {
    await showMenu(ctx, sb, chatId, '👇 Используйте меню ниже:');
  }
}

async function routeCallback(ctx: any, sb: any, cb: any) {
  const chatId: number = cb.message?.chat?.id;
  const data: string = cb.data ?? '';
  if (!chatId) return;

  await tg.answerCb(ctx, cb.id);

  if (data === 'auth:howto') {
    await tg.send(ctx, chatId, HOWTO_LINK, {
      reply_markup: { inline_keyboard: [[{ text: '🚀 Открыть приложение', web_app: { url: WEB_APP_URL } }]] },
    });
    return;
  }

  const { userId, role } = await getUserRole(sb, chatId);
  if (!userId) return handleNotLinked(ctx, chatId);

  // Worker: available jobs
  if (data.startsWith('wj:')) {
    const [, action, arg] = data.split(':');
    if (action === 'list') return showAvailableJobs(ctx, sb, chatId, userId, Math.max(0, parseInt(arg ?? '0', 10) || 0));
    if (action === 'resp' && arg) return respondToJob(ctx, sb, chatId, userId, arg);
  }

  // Worker: my jobs status
  if (data.startsWith('wm:')) {
    const [, action, arg, arg2] = data.split(':');
    if (action === 'list') return showMyJobs(ctx, sb, chatId, userId);
    if (action === 'st' && arg && arg2) return setWorkerStatus(ctx, sb, chatId, userId, arg, arg2);
  }

  // Dispatcher: create / list / close
  if (data.startsWith('dc:') && (role === 'dispatcher' || role === 'admin')) {
    const [, action, arg] = data.split(':');
    await handleDispatcherCallback(ctx, sb, chatId, userId, action, arg);
    return;
  }
}

// ============= Polling loop =============
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Missing configuration' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let ctx;
  try { ctx = getTgCtx(); } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const sb = createClient(supabaseUrl, supabaseServiceKey);

  const { data: state, error: stateErr } = await sb.from('telegram_bot_state').select('update_offset').eq('id', 1).single();
  if (stateErr) {
    console.error('[telegram-poll] state read error:', stateErr.message);
    return new Response(JSON.stringify({ error: stateErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let currentOffset: number = state.update_offset;
  let totalProcessed = 0;

  while (true) {
    const remainingMs = MAX_RUNTIME_MS - (Date.now() - startTime);
    if (remainingMs < MIN_REMAINING_MS) break;
    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    const response = await fetch(`${GATEWAY_URL}/getUpdates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ctx.apiKey}`,
        'X-Connection-Api-Key': ctx.connectionKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        offset: currentOffset,
        timeout,
        allowed_updates: ['message', 'channel_post', 'callback_query', 'my_chat_member'],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[telegram-poll] getUpdates failed:', data);
      return new Response(JSON.stringify({ error: data }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const updates = data.result ?? [];
    if (updates.length === 0) continue;

    for (const u of updates) {
      try {
        if (u.my_chat_member) {
          const chat = u.my_chat_member.chat;
          const newStatus: string = u.my_chat_member.new_chat_member?.status ?? '';
          const isBroadcast = chat?.type === 'channel' || chat?.type === 'group' || chat?.type === 'supergroup';
          const removed = newStatus === 'left' || newStatus === 'kicked';
          if (isBroadcast && removed) {
            await sb.from('telegram_user_channels').update({ is_active: false }).eq('chat_id', chat.id);
          }
          totalProcessed++;
          continue;
        }

        if (u.channel_post) {
          const post = u.channel_post;
          const chat = post.chat;
          if (chat?.id && chat.type === 'channel') {
            const text: string = (post.text ?? post.caption ?? '').trim();
            if (text) await tryLinkChat(ctx, sb, chat, text);
          }
          totalProcessed++;
          continue;
        }

        if (u.callback_query) {
          await routeCallback(ctx, sb, u.callback_query);
          totalProcessed++;
          continue;
        }

        if (u.message?.chat?.id) {
          await routeMessage(ctx, sb, u.message);
          totalProcessed++;
        }
      } catch (e) {
        console.error('[telegram-poll] update handler error:', e, 'update:', JSON.stringify(u).slice(0, 500));
      }
    }

    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    const { error: offsetErr } = await sb
      .from('telegram_bot_state')
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (offsetErr) {
      console.error('[telegram-poll] offset update error:', offsetErr.message);
      return new Response(JSON.stringify({ error: offsetErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    currentOffset = newOffset;
  }

  return new Response(
    JSON.stringify({ ok: true, processed: totalProcessed, finalOffset: currentOffset }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
