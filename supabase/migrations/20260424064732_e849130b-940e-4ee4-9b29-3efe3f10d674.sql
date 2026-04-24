-- Consolidate all "Сообщество диспетчеров" duplicate conversations into the canonical one
DO $$
DECLARE
  canonical_id uuid;
  dup_id uuid;
BEGIN
  -- Get the canonical conversation id from app_settings
  SELECT (value->>'conversation_id')::uuid INTO canonical_id
  FROM public.app_settings
  WHERE id = 'dispatcher_community_conversation_id';

  IF canonical_id IS NULL THEN
    RAISE NOTICE 'No canonical id, skipping';
    RETURN;
  END IF;

  -- For each duplicate, move participants & messages to canonical, then delete it
  FOR dup_id IN
    SELECT id FROM public.conversations
    WHERE title = 'Сообщество диспетчеров'
      AND is_group = true
      AND id <> canonical_id
  LOOP
    -- Move participants (skip duplicates)
    INSERT INTO public.conversation_participants (conversation_id, user_id, last_read_at)
    SELECT canonical_id, user_id, last_read_at
    FROM public.conversation_participants
    WHERE conversation_id = dup_id
    ON CONFLICT DO NOTHING;

    -- Move messages
    UPDATE public.messages SET conversation_id = canonical_id WHERE conversation_id = dup_id;

    -- Delete remaining
    DELETE FROM public.conversation_participants WHERE conversation_id = dup_id;
    DELETE FROM public.voice_rooms WHERE conversation_id = dup_id;
    DELETE FROM public.conversations WHERE id = dup_id;
  END LOOP;
END $$;

-- Prevent future duplicates: make join_dispatcher_community resilient by adding unique participant constraint if missing
CREATE UNIQUE INDEX IF NOT EXISTS conversation_participants_unique_user_conv
  ON public.conversation_participants (conversation_id, user_id);