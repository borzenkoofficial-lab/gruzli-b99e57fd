// Dispatcher-side handlers: FSM-сценарий создания заявки, список своих заявок
import { tg, type TgCtx } from './api.ts';
import { inline, WEB_APP_URL, MENU_LABELS } from './keyboards.ts';
import { clearFsm, getFsm, setFsm, type FsmRow } from './fsm.ts';

const escapeHtml = (s: string) =>
  String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

const SKIP = '➖ Пропустить';
const CANCEL_HINT = `\n\n<i>Нажмите «${MENU_LABELS.cancel}» чтобы прервать.</i>`;

// ===== FSM состояния =====
// dc:title → dc:desc → dc:address → dc:metro → dc:rate → dc:duration
//   → dc:workers → dc:start → dc:urgent → dc:confirm

function kbCancel() {
  return {
    reply_markup: {
      keyboard: [[{ text: MENU_LABELS.cancel }]],
      resize_keyboard: true,
      is_persistent: true,
    },
  };
}

function kbSkip() {
  return {
    reply_markup: {
      keyboard: [[{ text: SKIP }], [{ text: MENU_LABELS.cancel }]],
      resize_keyboard: true,
      is_persistent: true,
    },
  };
}

function kbYesNo() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: '⚡️ Срочная' }, { text: '🟢 Обычная' }],
        [{ text: MENU_LABELS.cancel }],
      ],
      resize_keyboard: true,
      is_persistent: true,
    },
  };
}

// ===== Старт сценария =====
export async function startCreateJob(ctx: TgCtx, sb: any, chatId: number, userId: string) {
  await setFsm(sb, chatId, 'dc:title', {}, userId);
  await tg.send(
    ctx,
    chatId,
    '➕ <b>Новая заявка</b>\n\n1/9 — Введите <b>название</b> заявки (например: «Разгрузка фуры»).' + CANCEL_HINT,
    kbCancel(),
  );
}

// ===== Парсер даты =====
// Поддержка: ДД.ММ ЧЧ:ММ, ДД.ММ.ГГГГ ЧЧ:ММ, «сегодня 14:00», «завтра 09:30», ЧЧ:ММ (сегодня)
function parseDateTime(input: string): Date | null {
  const s = input.trim().toLowerCase();
  const now = new Date();

  const todayMatch = s.match(/^(сегодня|today)\s+(\d{1,2}):(\d{2})$/i);
  const tomorrowMatch = s.match(/^(завтра|tomorrow)\s+(\d{1,2}):(\d{2})$/i);
  const timeOnly = s.match(/^(\d{1,2}):(\d{2})$/);
  const full = s.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\s+(\d{1,2}):(\d{2})$/);

  let y = now.getFullYear(), mo = now.getMonth(), d = now.getDate(), h = 0, mi = 0;

  if (timeOnly) {
    h = +timeOnly[1]; mi = +timeOnly[2];
  } else if (todayMatch) {
    h = +todayMatch[2]; mi = +todayMatch[3];
  } else if (tomorrowMatch) {
    const t = new Date(now); t.setDate(t.getDate() + 1);
    y = t.getFullYear(); mo = t.getMonth(); d = t.getDate();
    h = +tomorrowMatch[2]; mi = +tomorrowMatch[3];
  } else if (full) {
    d = +full[1]; mo = +full[2] - 1;
    if (full[3]) { y = +full[3]; if (y < 100) y += 2000; }
    h = +full[4]; mi = +full[5];
  } else {
    return null;
  }

  // Считаем московское время (UTC+3) — конвертируем в UTC
  const utcMs = Date.UTC(y, mo, d, h - 3, mi);
  const dt = new Date(utcMs);
  if (isNaN(dt.getTime())) return null;
  return dt;
}

function fmtJobPreview(data: any): string {
  return [
    `📋 <b>${escapeHtml(data.title)}</b>`,
    data.description ? escapeHtml(data.description) : null,
    data.address ? `📍 ${escapeHtml(data.address)}` : null,
    data.metro ? `🚇 ${escapeHtml(data.metro)}` : null,
    `💰 ${data.hourly_rate} ₽/ч × ${data.duration_hours} ч`,
    `👥 нужно: ${data.workers_needed}`,
    data.start_time ? `🕒 ${new Date(data.start_time).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}` : '🕒 как можно скорее',
    data.urgent ? '⚡️ <b>СРОЧНАЯ</b>' : null,
  ].filter(Boolean).join('\n');
}

// ===== Главный шаг FSM =====
// Возвращает true, если состояние обработано (значит, не нужно показывать общее меню)
export async function handleDispatcherFsm(
  ctx: TgCtx, sb: any, chatId: number, userId: string, fsm: FsmRow, text: string,
): Promise<boolean> {
  if (!fsm.state.startsWith('dc:')) return false;
  const data = { ...(fsm.data ?? {}) };

  // Универсальные хелперы
  const reject = (msg: string) => tg.send(ctx, chatId, `⚠️ ${msg}`);
  const advance = (state: string, prompt: string, kb: any = kbCancel()) =>
    setFsm(sb, chatId, state, data, userId).then(() => tg.send(ctx, chatId, prompt + CANCEL_HINT, kb));

  switch (fsm.state) {
    case 'dc:title': {
      if (text.length < 3 || text.length > 120) {
        await reject('Название от 3 до 120 символов. Попробуйте ещё раз.');
        return true;
      }
      data.title = text;
      await advance('dc:desc', '2/9 — <b>Описание</b> работ (или «' + SKIP + '»).', kbSkip());
      return true;
    }
    case 'dc:desc': {
      if (text !== SKIP) data.description = text.slice(0, 2000);
      await advance('dc:address', '3/9 — <b>Адрес</b> (улица, дом).', kbSkip());
      return true;
    }
    case 'dc:address': {
      if (text !== SKIP) data.address = text.slice(0, 300);
      await advance('dc:metro', '4/9 — <b>Метро</b> (или «' + SKIP + '»).', kbSkip());
      return true;
    }
    case 'dc:metro': {
      if (text !== SKIP) data.metro = text.slice(0, 100);
      await advance('dc:rate', '5/9 — <b>Ставка ₽/час</b> (число, например 500).');
      return true;
    }
    case 'dc:rate': {
      const v = parseInt(text.replace(/\s/g, ''), 10);
      if (!Number.isFinite(v) || v < 100 || v > 100000) {
        await reject('Введите число от 100 до 100000.');
        return true;
      }
      data.hourly_rate = v;
      await advance('dc:duration', '6/9 — <b>Длительность в часах</b> (например 4 или 2.5).');
      return true;
    }
    case 'dc:duration': {
      const v = parseFloat(text.replace(',', '.'));
      if (!Number.isFinite(v) || v <= 0 || v > 24) {
        await reject('Введите число часов от 0.5 до 24.');
        return true;
      }
      data.duration_hours = v;
      await advance('dc:workers', '7/9 — <b>Сколько грузчиков</b> нужно? (число)');
      return true;
    }
    case 'dc:workers': {
      const v = parseInt(text, 10);
      if (!Number.isFinite(v) || v < 1 || v > 50) {
        await reject('От 1 до 50 человек.');
        return true;
      }
      data.workers_needed = v;
      await advance(
        'dc:start',
        '8/9 — <b>Когда начать?</b>\nФорматы: <code>сегодня 14:00</code>, <code>завтра 09:30</code>, <code>16:00</code>, <code>25.05 14:00</code>. Или «' + SKIP + '».',
        kbSkip(),
      );
      return true;
    }
    case 'dc:start': {
      if (text !== SKIP) {
        const dt = parseDateTime(text);
        if (!dt) {
          await reject('Не удалось распознать время. Попробуйте «сегодня 14:00» или «25.05 09:30».');
          return true;
        }
        data.start_time = dt.toISOString();
      }
      await advance(
        'dc:urgent',
        '9/9 — Заявка <b>срочная</b>? Срочные показываются первыми и подсвечиваются у грузчиков.',
        kbYesNo(),
      );
      return true;
    }
    case 'dc:urgent': {
      data.urgent = text.includes('⚡') || text.toLowerCase().includes('сроч');
      await setFsm(sb, chatId, 'dc:confirm', data, userId);
      await tg.send(
        ctx,
        chatId,
        '<b>Проверьте заявку:</b>\n\n' + fmtJobPreview(data),
        inline([
          [{ text: '✅ Опубликовать', callback_data: 'dc:save' }],
          [{ text: '❌ Отмена', callback_data: 'dc:cancel' }],
        ]),
      );
      return true;
    }
    case 'dc:confirm': {
      // На этом шаге ждём callback, а не текст
      await tg.send(ctx, chatId, 'Нажмите «Опубликовать» или «Отмена» под предпросмотром.');
      return true;
    }
  }
  return false;
}

// ===== Callback-обработка =====
export async function handleDispatcherCallback(
  ctx: TgCtx, sb: any, chatId: number, userId: string, action: string, _arg?: string,
): Promise<boolean> {
  if (action === 'save') {
    const fsm = await getFsm(sb, chatId);
    if (!fsm || fsm.state !== 'dc:confirm') {
      await tg.send(ctx, chatId, '⚠️ Сессия истекла. Начните создание заявки заново.');
      return true;
    }
    const d = fsm.data ?? {};
    const row: Record<string, unknown> = {
      dispatcher_id: userId,
      title: d.title,
      description: d.description ?? '',
      hourly_rate: d.hourly_rate,
      duration_hours: d.duration_hours,
      workers_needed: d.workers_needed,
      address: d.address ?? '',
      metro: d.metro ?? '',
      urgent: !!d.urgent,
      status: 'active',
    };
    if (d.start_time) row.start_time = d.start_time;

    const { data: inserted, error } = await sb
      .from('jobs')
      .insert(row)
      .select('id')
      .single();

    await clearFsm(sb, chatId);

    if (error) {
      await tg.send(ctx, chatId, `⚠️ Не удалось создать заявку: ${escapeHtml(error.message)}`);
      return true;
    }

    await tg.send(
      ctx,
      chatId,
      `✅ <b>Заявка опубликована!</b>\n\n${fmtJobPreview(d)}\n\nОна уже доступна грузчикам.`,
      inline([
        [{ text: '🌐 Открыть в приложении', web_app: { url: `${WEB_APP_URL}job/${inserted.id}` } }],
        [{ text: '➕ Создать ещё', callback_data: 'dc:new' }],
      ]),
    );
    return true;
  }

  if (action === 'cancel') {
    await clearFsm(sb, chatId);
    await tg.send(ctx, chatId, '❌ Создание заявки отменено.');
    return true;
  }

  if (action === 'new') {
    await startCreateJob(ctx, sb, chatId, userId);
    return true;
  }

  if (action === 'jobs') {
    await showDispatcherJobs(ctx, sb, chatId, userId);
    return true;
  }

  if (action === 'close' && _arg) {
    const { error } = await sb
      .from('jobs')
      .update({ status: 'closed' })
      .eq('id', _arg)
      .eq('dispatcher_id', userId);
    if (error) {
      await tg.send(ctx, chatId, `⚠️ ${escapeHtml(error.message)}`);
    } else {
      await tg.send(ctx, chatId, '🔒 Заявка закрыта.');
    }
    return true;
  }

  return false;
}

// ===== Список моих заявок (диспетчер) =====
export async function showDispatcherJobs(ctx: TgCtx, sb: any, chatId: number, userId: string) {
  const { data: jobs } = await sb
    .from('jobs')
    .select('id, title, address, hourly_rate, duration_hours, workers_needed, status, urgent, start_time, created_at')
    .eq('dispatcher_id', userId)
    .order('created_at', { ascending: false })
    .limit(15);

  if (!jobs || jobs.length === 0) {
    await tg.send(
      ctx, chatId,
      '📭 У вас пока нет заявок.',
      inline([[{ text: '➕ Создать заявку', callback_data: 'dc:new' }]]),
    );
    return;
  }

  await tg.send(ctx, chatId, `📂 <b>Мои заявки</b> (${jobs.length})`);

  for (const j of jobs as any[]) {
    const [{ count: respCount }, { count: acceptedCount }] = await Promise.all([
      sb.from('job_responses').select('*', { count: 'exact', head: true }).eq('job_id', j.id),
      sb.from('job_responses').select('*', { count: 'exact', head: true }).eq('job_id', j.id).eq('status', 'accepted'),
    ]);
    const statusLabel = j.status === 'active' ? '🟢 Активна' : j.status === 'closed' ? '🔒 Закрыта' : `📦 ${j.status}`;
    const text = [
      `📋 <b>${escapeHtml(j.title)}</b>`,
      j.urgent ? '⚡️ СРОЧНО' : null,
      j.address ? `📍 ${escapeHtml(j.address)}` : null,
      `💰 ${j.hourly_rate} ₽/ч × ${j.duration_hours} ч  👥 ${j.workers_needed}`,
      j.start_time ? `🕒 ${new Date(j.start_time).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}` : null,
      `\nСтатус: ${statusLabel}`,
      `Откликов: <b>${respCount ?? 0}</b>  •  Принято: <b>${acceptedCount ?? 0}</b>`,
    ].filter(Boolean).join('\n');

    const rows: any[][] = [[{ text: '🌐 В приложении', web_app: { url: `${WEB_APP_URL}job/${j.id}` } }]];
    if (j.status === 'active') rows.push([{ text: '🔒 Закрыть', callback_data: `dc:close:${j.id}` }]);

    await tg.send(ctx, chatId, text, inline(rows));
  }
}
