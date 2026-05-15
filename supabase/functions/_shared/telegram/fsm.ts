// FSM state helpers: load / save / clear conversational state per chat_id

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface FsmRow {
  chat_id: number;
  user_id: string | null;
  state: string;
  data: Record<string, any>;
}

export async function getFsm(sb: SupabaseClient, chatId: number): Promise<FsmRow | null> {
  const { data } = await sb
    .from('telegram_fsm_state')
    .select('chat_id, user_id, state, data, expires_at')
    .eq('chat_id', chatId)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) {
    await sb.from('telegram_fsm_state').delete().eq('chat_id', chatId);
    return null;
  }
  return { chat_id: chatId, user_id: data.user_id, state: data.state, data: data.data ?? {} };
}

export async function setFsm(
  sb: SupabaseClient,
  chatId: number,
  state: string,
  data: Record<string, any> = {},
  userId: string | null = null,
) {
  await sb.from('telegram_fsm_state').upsert(
    {
      chat_id: chatId,
      user_id: userId,
      state,
      data,
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    { onConflict: 'chat_id' },
  );
}

export async function clearFsm(sb: SupabaseClient, chatId: number) {
  await sb.from('telegram_fsm_state').delete().eq('chat_id', chatId);
}
