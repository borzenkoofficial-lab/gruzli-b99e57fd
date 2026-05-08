
-- Функция: новая заявка → push всем подписчикам
CREATE OR REPLACE FUNCTION public.notify_push4site_new_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZHRkZnpueXpwcWtmaHByYmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODQwMzQsImV4cCI6MjA5MDc2MDAzNH0.iorniY3SKOCmyFPoqblZPXXX0P2gnEDLFL5HxaZq9G8';
BEGIN
  IF NEW.is_bot = true THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM 'active' THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url := 'https://iudtdfznyzpqkfhprbad.supabase.co/functions/v1/send-push4site',
    body := jsonb_build_object(
      'title', 'Новая заявка: ' || COALESCE(NEW.title, ''),
      'body', COALESCE(NEW.address, '') || ' • ' || COALESCE(NEW.hourly_rate::text || '₽/ч', ''),
      'url', 'https://gruzli.lovable.app/'
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

-- Функция: новое сообщение → push
CREATE OR REPLACE FUNCTION public.notify_push4site_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZHRkZnpueXpwcWtmaHByYmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODQwMzQsImV4cCI6MjA5MDc2MDAzNH0.iorniY3SKOCmyFPoqblZPXXX0P2gnEDLFL5HxaZq9G8';
  sender_name text;
  preview text;
BEGIN
  SELECT full_name INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;
  preview := COALESCE(NULLIF(NEW.text, ''), '[медиа]');

  PERFORM net.http_post(
    url := 'https://iudtdfznyzpqkfhprbad.supabase.co/functions/v1/send-push4site',
    body := jsonb_build_object(
      'title', COALESCE(sender_name, 'Новое сообщение'),
      'body', preview,
      'url', 'https://gruzli.lovable.app/'
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

DROP TRIGGER IF EXISTS on_new_job_push4site ON public.jobs;
CREATE TRIGGER on_new_job_push4site
AFTER INSERT ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.notify_push4site_new_job();

DROP TRIGGER IF EXISTS on_new_message_push4site ON public.messages;
CREATE TRIGGER on_new_message_push4site
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_push4site_new_message();
