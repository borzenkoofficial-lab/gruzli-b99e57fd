// Worker-side handlers: список доступных заявок, мои работы, смена статусов

import { tg, type TgCtx } from './api.ts';
import { inline, WEB_APP_URL } from './keyboards.ts';

const PAGE_SIZE = 5;

const STATUS_LABELS: Record<string, string> = {
  en_route: '🚗 В пути',
  arrived: '📍 Прибыл',
  working: '🛠 Выполняю',
  completed: '✅ Завершил',
};

const STATUS_NEXT: Record<string, string | null> = {
  // null = текущий начальный, en_route первый шаг
  '': 'en_route',
  en_route: 'arrived',
  arrived: 'working',
  working: 'completed',
  completed: null,
};

function fmtJob(j: any): string {
  const lines = [
    `📋 <b>${escapeHtml(j.title ?? 'Заявка')}</b>`,
    j.address ? `📍 ${escapeHtml(j.address)}` : null,
    j.metro ? `🚇 ${escapeHtml(j.metro)}` : null,
    j.hourly_rate ? `💰 ${j.hourly_rate} ₽/ч${j.duration_hours ? ` × ${j.duration_hours} ч` : ''}` : null,
    j.start_time ? `🕒 ${new Date(j.start_time).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}` : null,
    j.workers_needed ? `👥 нужно: ${j.workers_needed}` : null,
    j.urgent ? '⚡️ <b>СРОЧНО</b>' : null,
    j.description ? `\n${escapeHtml(String(j.description).slice(0, 400))}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}

// ===== Список доступных заявок =====
export async function showAvailableJobs(ctx: TgCtx, sb: any, chatId: number, userId: string, page = 0) {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // исключаем заявки, на которые уже откликались
  const { data: myResp } = await sb
    .from('job_responses')
    .select('job_id')
    .eq('worker_id', userId);
  const excludedIds = (myResp ?? []).map((r: any) => r.job_id);

  let q = sb
    .from('jobs')
    .select('id, title, address, metro, hourly_rate, duration_hours, start_time, workers_needed, urgent, description', { count: 'exact' })
    .eq('status', 'active')
    .order('urgent', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (excludedIds.length) q = q.not('id', 'in', `(${excludedIds.join(',')})`);

  const { data: jobs, count } = await q;

  if (!jobs || jobs.length === 0) {
    return tg.send(ctx, chatId, '📭 Сейчас нет доступных заявок. Загляните позже — мы пришлём уведомление при появлении.');
  }

  await tg.send(ctx, chatId, `📋 <b>Доступные заявки</b> (${count ?? jobs.length})`);

  for (const j of jobs) {
    await tg.send(ctx, chatId, fmtJob(j), inline([
      [{ text: '✅ Откликнуться', callback_data: `wj:resp:${j.id}` }],
      [{ text: '🌐 Открыть в приложении', web_app: { url: `${WEB_APP_URL}job/${j.id}` } }],
    ]));
  }

  const hasNext = (count ?? 0) > to + 1;
  if (page > 0 || hasNext) {
    const row: any[] = [];
    if (page > 0) row.push({ text: '⬅️', callback_data: `wj:list:${page - 1}` });
    if (hasNext) row.push({ text: '➡️', callback_data: `wj:list:${page + 1}` });
    await tg.send(ctx, chatId, `Страница ${page + 1}`, inline([row]));
  }
}

export async function respondToJob(ctx: TgCtx, sb: any, chatId: number, userId: string, jobId: string) {
  const { data: existing } = await sb
    .from('job_responses')
    .select('id')
    .eq('job_id', jobId)
    .eq('worker_id', userId)
    .maybeSingle();
  if (existing) {
    return tg.send(ctx, chatId, '☑️ Вы уже откликались на эту заявку.');
  }

  const { error } = await sb.from('job_responses').insert({
    job_id: jobId,
    worker_id: userId,
    status: 'pending',
    message: 'Отклик из Telegram-бота',
  });

  if (error) {
    return tg.send(ctx, chatId, `⚠️ Не удалось откликнуться: ${escapeHtml(error.message)}`);
  }
  await tg.send(ctx, chatId, '✅ Отклик отправлен! Диспетчер увидит его и свяжется с вами.');
}

// ===== Мои работы =====
export async function showMyJobs(ctx: TgCtx, sb: any, chatId: number, userId: string) {
  const { data: resps } = await sb
    .from('job_responses')
    .select('id, status, worker_status, hours_worked, earned, jobs:job_id(id, title, address, hourly_rate, start_time, status)')
    .eq('worker_id', userId)
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(20);

  if (!resps || resps.length === 0) {
    return tg.send(ctx, chatId, '📭 У вас нет активных работ. Откликнитесь на заявку в разделе «Доступные заявки».');
  }

  await tg.send(ctx, chatId, `🛠 <b>Мои работы</b> (${resps.length})`);

  for (const r of resps as any[]) {
    const j = r.jobs;
    if (!j) continue;
    const statusBadge = r.status === 'pending'
      ? '⏳ Ожидает подтверждения'
      : `${STATUS_LABELS[r.worker_status ?? ''] ?? '🟢 Принят'}`;
    const text = [
      `📋 <b>${escapeHtml(j.title ?? 'Заявка')}</b>`,
      j.address ? `📍 ${escapeHtml(j.address)}` : null,
      j.hourly_rate ? `💰 ${j.hourly_rate} ₽/ч` : null,
      j.start_time ? `🕒 ${new Date(j.start_time).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}` : null,
      `\nСтатус: <b>${statusBadge}</b>`,
      r.earned ? `Заработано: <b>${r.earned} ₽</b>` : null,
    ].filter(Boolean).join('\n');

    const rows: any[][] = [];
    if (r.status === 'accepted') {
      const next = STATUS_NEXT[r.worker_status ?? ''];
      if (next) {
        rows.push([{ text: `Отметить: ${STATUS_LABELS[next]}`, callback_data: `wm:st:${r.id}:${next}` }]);
      }
    }
    rows.push([{ text: '🌐 В приложении', web_app: { url: `${WEB_APP_URL}job/${j.id}` } }]);

    await tg.send(ctx, chatId, text, inline(rows));
  }
}

export async function setWorkerStatus(ctx: TgCtx, sb: any, chatId: number, userId: string, responseId: string, status: string) {
  if (!['en_route', 'arrived', 'working', 'completed'].includes(status)) return;

  const patch: Record<string, unknown> = { worker_status: status };
  if (status === 'working') patch.work_started_at = new Date().toISOString();
  if (status === 'completed') patch.work_finished_at = new Date().toISOString();

  const { error } = await sb
    .from('job_responses')
    .update(patch)
    .eq('id', responseId)
    .eq('worker_id', userId);

  if (error) {
    return tg.send(ctx, chatId, `⚠️ Не удалось обновить статус: ${escapeHtml(error.message)}`);
  }
  await tg.send(ctx, chatId, `✅ Статус обновлён: <b>${STATUS_LABELS[status]}</b>`);
}
