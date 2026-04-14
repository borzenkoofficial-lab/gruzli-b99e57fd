
-- 1. Fix handle_new_user to prevent admin role injection
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 
    CASE 
      WHEN (NEW.raw_user_meta_data->>'role') = 'dispatcher' THEN 'dispatcher'::app_role
      ELSE 'worker'::app_role
    END
  );
  
  RETURN NEW;
END;
$$;

-- 2. Drop dangerous INSERT policy on user_roles
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;

-- 3. Fix conversation_participants INSERT policy
DROP POLICY IF EXISTS "Authenticated can add participants" ON public.conversation_participants;
CREATE POLICY "Participants or creators can add participants"
  ON public.conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      is_conversation_participant(conversation_id, auth.uid())
      OR is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id
        AND NOT EXISTS (
          SELECT 1 FROM public.conversation_participants cp
          WHERE cp.conversation_id = c.id
        )
      )
    )
  );

-- 4. Fix chat-media storage: make bucket private and fix policies
UPDATE storage.buckets SET public = false WHERE id = 'chat-media';

DROP POLICY IF EXISTS "Anyone can view chat media" ON storage.objects;
CREATE POLICY "Participants can view chat media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND public.is_conversation_participant(
      (storage.foldername(name))[1]::uuid, auth.uid()
    )
  );

-- 5. Fix kartoteka-photos storage ownership policies
DROP POLICY IF EXISTS "Anyone can delete kartoteka photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update kartoteka photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own kartoteka photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own kartoteka photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete kartoteka photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update kartoteka photos" ON storage.objects;

CREATE POLICY "Users can delete own kartoteka photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'kartoteka-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own kartoteka photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'kartoteka-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 6. Fix function search paths for functions missing it
CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;
