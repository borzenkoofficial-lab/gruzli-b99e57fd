-- Ensure old/nonexistent push triggers are not used anymore
DROP TRIGGER IF EXISTS on_new_job_notify ON public.jobs;
DROP TRIGGER IF EXISTS on_new_message_notify ON public.messages;
DROP TRIGGER IF EXISTS on_worker_status_change_notify ON public.job_responses;
DROP TRIGGER IF EXISTS on_new_job_push ON public.jobs;
DROP TRIGGER IF EXISTS on_new_message_push ON public.messages;
DROP TRIGGER IF EXISTS on_worker_status_change_push ON public.job_responses;
DROP TRIGGER IF EXISTS on_new_job_push4site ON public.jobs;
DROP TRIGGER IF EXISTS on_new_message_push4site ON public.messages;
DROP TRIGGER IF EXISTS on_new_response_push4site ON public.job_responses;

-- New job/order -> Push4site
CREATE OR REPLACE FUNCTION public.notify_push4site_new_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6Iml1ZHRkZnpueXpwcWtmaHByYmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODQwMzQsImV4cCI6MjA5MDc2MDAzNH0.iorniY3SKOCmyFPoqblZPXXX0P2gnEDLFL5HxaZq9G8';
  v_body text;
BEGIN
  IF COALESCE(NEW.is_bot, false) = true THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM 'active' THEN RETURN NEW; END IF;

  v_body := concat_ws(' • ', NULLIF(NEW.address, ''), CASE WHEN NEW.hourly_rate IS NOT NULL THEN NEW.hourly_rate::text || '₽/ч' ELSE NULL END);

  PERFORM net.http_post(
    url := 'https://iudtdfznyzpqkfhprbad.supabase.co/functions/v1/send-push4site',
    body := jsonb_build_object(
      'title', left('Новая заявка: ' || COALESCE(NEW.title, 'Без названия'), 120),
      'body', left(COALESCE(NULLIF(v_body, ''), COALESCE(NEW.description, 'Открыта новая заявка')), 240),
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

-- New chat message -> Push4site
CREATE OR REPLACE FUNCTION public.notify_push4site_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6Iml1ZHRkZnpueXpwcWtmaHByYmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODQwMzQsImV4cCI6MjA5MDc2MDAzNH0.iorniY3SKOCmyFPoqblZPXXX0P2gnEDLFL5HxaZq9G8';
  sender_name text;
  preview text;
BEGIN
  SELECT NULLIF(full_name, '') INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;
  preview := COALESCE(NULLIF(NEW.text, ''), '[медиа]');

  PERFORM net.http_post(
    url := 'https://iudtdfznyzpqkfhprbad.supabase.co/functions/v1/send-push4site',
    body := jsonb_build_object(
      'title', left(COALESCE(sender_name, 'Новое сообщение'), 120),
      'body', left(preview, 240),
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

-- New response to a job -> Push4site
CREATE OR REPLACE FUNCTION public.notify_push4site_new_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6Iml1ZHRkZnpueXpwcWtmaHByYmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODQwMzQsImV4cCI6MjA5MDc2MDAzNH0.iorniY3SKOCmyFPoqblZPXXX0P2gnEDLFL5HxaZq9G8';
  job_title text;
  worker_name text;
BEGIN
  SELECT title INTO job_title FROM public.jobs WHERE id = NEW.job_id;
  SELECT NULLIF(full_name, '') INTO worker_name FROM public.profiles WHERE user_id = NEW.worker_id;

  PERFORM net.http_post(
    url := 'https://iudtdfznyzpqkfhprbad.supabase.co/functions/v1/send-push4site',
    body := jsonb_build_object(
      'title', 'Новый отклик на заявку',
      'body', left(COALESCE(worker_name, 'Грузчик') || ' откликнулся: ' || COALESCE(job_title, 'заявка'), 240),
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

CREATE TRIGGER on_new_job_push4site
AFTER INSERT ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.notify_push4site_new_job();

CREATE TRIGGER on_new_message_push4site
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_push4site_new_message();

CREATE TRIGGER on_new_response_push4site
AFTER INSERT ON public.job_responses
FOR EACH ROW EXECUTE FUNCTION public.notify_push4site_new_response();