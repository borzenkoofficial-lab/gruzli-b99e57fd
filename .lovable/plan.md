

# Полное удаление диалога для всех участников

## Что сейчас
При удалении диалога удаляется только запись `conversation_participants` текущего пользователя — диалог пропадает у него, но остаётся у собеседника. Сообщения и медиафайлы остаются в базе и хранилище.

## Что сделаем
При удалении диалога любым участником — полностью удаляются:
1. Все сообщения диалога (из таблицы `messages`)
2. Медиафайлы из storage (`chat-media`)
3. Все записи участников (`conversation_participants`)
4. Сам диалог (`conversations`)

Это освободит место в базе и хранилище.

## План реализации

### 1. Создать серверную функцию (database function)
SQL-функция `delete_conversation_fully(conv_id uuid)` с `SECURITY DEFINER`, которая:
- Проверяет, что вызывающий — участник этого диалога
- Собирает `media_url` из всех сообщений (для удаления файлов)
- Удаляет `messages` → `conversation_participants` → `conversations` каскадно
- Возвращает список media_url для очистки storage

### 2. Добавить RLS-политику DELETE на `conversations`
Сейчас DELETE на `conversations` запрещён. Добавим политику: участник может удалить диалог.

### 3. Обновить клиентский код
В `RealChatsScreen.tsx` и `RealChatScreen.tsx`:
- Вызывать `supabase.rpc('delete_conversation_fully', { _conversation_id: conv.id })`
- После успешного удаления — вызвать удаление медиафайлов из storage bucket `chat-media`
- Добавить подтверждение ("Диалог будет удалён у всех участников")

### 4. Целостность
- Голосовые комнаты (`voice_rooms`) тоже удаляются в функции
- Realtime-подписки у собеседника автоматически получат событие DELETE и обновят UI
- Групповые чаты (если `is_group = true`) можно защитить — удалять полностью только 1-на-1 диалоги, а в групповых просто выходить

## Технические детали

**Миграция (SQL):**
```sql
-- Функция полного удаления диалога
CREATE OR REPLACE FUNCTION public.delete_conversation_fully(_conversation_id uuid)
RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE media_urls text[];
BEGIN
  IF NOT is_conversation_participant(_conversation_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;
  
  SELECT array_agg(media_url) INTO media_urls
  FROM messages WHERE conversation_id = _conversation_id
    AND media_url IS NOT NULL AND media_url != '';
  
  DELETE FROM messages WHERE conversation_id = _conversation_id;
  DELETE FROM voice_rooms WHERE conversation_id = _conversation_id;
  DELETE FROM conversation_participants WHERE conversation_id = _conversation_id;
  DELETE FROM conversations WHERE id = _conversation_id;
  
  RETURN COALESCE(media_urls, '{}');
END;
$$;
```

**Клиент** — после вызова rpc, удалить файлы из storage:
```ts
const { data: urls } = await supabase.rpc('delete_conversation_fully', { _conversation_id: id });
if (urls?.length) {
  const paths = urls.map(u => /* извлечь path из URL */);
  await supabase.storage.from('chat-media').remove(paths);
}
```

