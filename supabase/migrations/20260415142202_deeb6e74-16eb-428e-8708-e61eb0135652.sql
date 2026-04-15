
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
