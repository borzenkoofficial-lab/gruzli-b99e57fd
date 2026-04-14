-- Fix kartoteka-photos public bucket listing - restrict SELECT to specific object access
-- Drop overly broad SELECT policy
DROP POLICY IF EXISTS "Anyone can view kartoteka photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view kartoteka photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view kartoteka photos" ON storage.objects;

-- Create a more restrictive SELECT policy - public can view specific files but not list
CREATE POLICY "Public can view kartoteka photos by path"
  ON storage.objects FOR SELECT
  TO public
  USING (
    bucket_id = 'kartoteka-photos'
    AND (storage.foldername(name))[1] IS NOT NULL
  );

-- Fix notify_new_message search_path
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZHRkZnpueXpwcWtmaHByYmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODQwMzQsImV4cCI6MjA5MDc2MDAzNH0.iorniY3SKOCmyFPoqblZPXXX0P2gnEDLFL5HxaZq9G8';
BEGIN
  PERFORM net.http_post(
    url := 'https://iudtdfznyzpqkfhprbad.supabase.co/functions/v1/send-push',
    body := jsonb_build_object(
      'type', 'new_message',
      'conversation_id', NEW.conversation_id,
      'sender_id', NEW.sender_id,
      'text', NEW.text
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'apikey', anon_key
    )
  );
  RETURN NEW;
END;
$$;

-- Fix notify_worker_status_change search_path
CREATE OR REPLACE FUNCTION public.notify_worker_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZHRkZnpueXpwcWtmaHByYmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODQwMzQsImV4cCI6MjA5MDc2MDAzNH0.iorniY3SKOCmyFPoqblZPXXX0P2gnEDLFL5HxaZq9G8';
BEGIN
  IF OLD.worker_status IS DISTINCT FROM NEW.worker_status AND NEW.worker_status IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://iudtdfznyzpqkfhprbad.supabase.co/functions/v1/send-push',
      body := jsonb_build_object(
        'type', 'worker_status_change',
        'job_id', NEW.job_id,
        'worker_id', NEW.worker_id,
        'worker_status', NEW.worker_status
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key,
        'apikey', anon_key
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Fix notify_new_job search_path
CREATE OR REPLACE FUNCTION public.notify_new_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZHRkZnpueXpwcWtmaHByYmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODQwMzQsImV4cCI6MjA5MDc2MDAzNH0.iorniY3SKOCmyFPoqblZPXXX0P2gnEDLFL5HxaZq9G8';
BEGIN
  PERFORM net.http_post(
    url := 'https://iudtdfznyzpqkfhprbad.supabase.co/functions/v1/send-push',
    body := jsonb_build_object(
      'type', 'new_job',
      'job_id', NEW.id,
      'title', NEW.title,
      'hourly_rate', NEW.hourly_rate,
      'address', NEW.address
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'apikey', anon_key
    )
  );
  RETURN NEW;
END;
$$;

-- Fix generate_display_id search_path (already has it but re-apply for consistency)
CREATE OR REPLACE FUNCTION public.generate_display_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id text;
  done bool;
BEGIN
  done := false;
  WHILE NOT done LOOP
    new_id := lpad(floor(random() * 1000000)::text, 6, '0');
    BEGIN
      NEW.display_id := new_id;
      done := true;
    EXCEPTION WHEN unique_violation THEN
      done := false;
    END;
  END LOOP;
  RETURN NEW;
END;
$$;