
CREATE OR REPLACE FUNCTION public.join_dispatcher_community()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
  v_user uuid := auth.uid();
  v_exists boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Read community conversation id from app_settings
  SELECT (value->>'conversation_id')::uuid INTO v_conv_id
  FROM public.app_settings
  WHERE id = 'dispatcher_community_conversation_id';

  -- If not set, create the conversation and store the id
  IF v_conv_id IS NULL THEN
    v_conv_id := gen_random_uuid();
    INSERT INTO public.conversations (id, title, is_group)
    VALUES (v_conv_id, 'Сообщество диспетчеров', true);

    INSERT INTO public.app_settings (id, value)
    VALUES ('dispatcher_community_conversation_id', jsonb_build_object('conversation_id', v_conv_id))
    ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;
  END IF;

  -- Add as participant if not already
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = v_conv_id AND user_id = v_user
  ) INTO v_exists;

  IF NOT v_exists THEN
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (v_conv_id, v_user);
  END IF;

  RETURN v_conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_dispatcher_community() TO authenticated;
