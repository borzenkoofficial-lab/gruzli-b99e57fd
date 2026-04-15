
CREATE OR REPLACE FUNCTION public.create_direct_conversation(
  _other_user_id uuid,
  _title text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _conversation_id uuid;
  _my_id uuid := auth.uid();
  _existing_conv_id uuid;
BEGIN
  IF _my_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check for existing 1-on-1 conversation
  SELECT cp1.conversation_id INTO _existing_conv_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  JOIN conversations c ON c.id = cp1.conversation_id
  WHERE cp1.user_id = _my_id
    AND cp2.user_id = _other_user_id
    AND (c.is_group IS NULL OR c.is_group = false)
  LIMIT 1;

  IF _existing_conv_id IS NOT NULL THEN
    RETURN _existing_conv_id;
  END IF;

  -- Create new conversation
  _conversation_id := gen_random_uuid();
  INSERT INTO conversations (id, title) VALUES (_conversation_id, _title);
  INSERT INTO conversation_participants (conversation_id, user_id) VALUES (_conversation_id, _my_id);
  INSERT INTO conversation_participants (conversation_id, user_id) VALUES (_conversation_id, _other_user_id);

  RETURN _conversation_id;
END;
$$;
