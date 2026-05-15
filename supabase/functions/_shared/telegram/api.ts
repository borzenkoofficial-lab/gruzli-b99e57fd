// Telegram Bot API helper (через Lovable connector gateway)

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

export interface TgCtx {
  apiKey: string;        // LOVABLE_API_KEY
  connectionKey: string; // TELEGRAM_API_KEY
}

export function getTgCtx(): TgCtx {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  const connectionKey = Deno.env.get('TELEGRAM_API_KEY');
  if (!apiKey || !connectionKey) throw new Error('Telegram credentials missing');
  return { apiKey, connectionKey };
}

async function call(ctx: TgCtx, method: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(`${GATEWAY_URL}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ctx.apiKey}`,
        'X-Connection-Api-Key': ctx.connectionKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) console.error(`[tg ${method}]`, json);
    return json;
  } catch (e) {
    console.error(`[tg ${method}] failed:`, e);
    return null;
  }
}

export const tg = {
  send: (ctx: TgCtx, chatId: number, text: string, extra: Record<string, unknown> = {}) =>
    call(ctx, 'sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...extra,
    }),

  edit: (ctx: TgCtx, chatId: number, messageId: number, text: string, extra: Record<string, unknown> = {}) =>
    call(ctx, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...extra,
    }),

  answerCb: (ctx: TgCtx, callbackQueryId: string, text?: string, show_alert = false) =>
    call(ctx, 'answerCallbackQuery', { callback_query_id: callbackQueryId, text, show_alert }),

  deleteMessage: (ctx: TgCtx, chatId: number, messageId: number) =>
    call(ctx, 'deleteMessage', { chat_id: chatId, message_id: messageId }),
};
