-- 1. Add user_id link to subscribers
ALTER TABLE public.telegram_subscribers
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_subscribers_user_id
  ON public.telegram_subscribers (user_id) WHERE user_id IS NOT NULL;

-- Allow user to see their own subscription row
CREATE POLICY "Users can view own telegram link"
  ON public.telegram_subscribers
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can unlink own telegram"
  ON public.telegram_subscribers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. One-time link codes
CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_user
  ON public.telegram_link_codes (user_id);

ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own link codes"
  ON public.telegram_link_codes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own link codes"
  ON public.telegram_link_codes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages link codes"
  ON public.telegram_link_codes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. Helper: post to personal-notify function
CREATE OR REPLACE FUNCTION public._notify_telegram_personal(_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZHRkZnpueXpwcWtmaHByYmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODQwMzQsImV4cCI6MjA5MDc2MDAzNH0.iorniY3SKOCmyFPoqblZPXXX0P2gnEDLFL5HxaZq9G8';
BEGIN
  PERFORM net.http_post(
    url := 'https://iudtdfznyzpqkfhprbad.supabase.co/functions/v1/notify-telegram-personal',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'apikey', anon_key
    )
  );
END;
$$;

-- 4. Trigger: new chat message → notify recipients (other participants)
CREATE OR REPLACE FUNCTION public.notify_personal_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  recipient record;
  sender_name text;
  preview text;
BEGIN
  SELECT full_name INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;
  preview := COALESCE(NULLIF(NEW.text, ''), '[медиа]');

  FOR recipient IN
    SELECT cp.user_id
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id <> NEW.sender_id
  LOOP
    PERFORM public._notify_telegram_personal(jsonb_build_object(
      'type', 'new_message',
      'user_id', recipient.user_id,
      'sender_name', COALESCE(sender_name, 'Пользователь'),
      'preview', preview,
      'conversation_id', NEW.conversation_id
    ));
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_personal_new_message ON public.messages;
CREATE TRIGGER trg_notify_personal_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_personal_new_message();

-- 5. Trigger: new job response → notify dispatcher
CREATE OR REPLACE FUNCTION public.notify_personal_new_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  job_row record;
  worker_name text;
BEGIN
  SELECT id, dispatcher_id, title INTO job_row FROM public.jobs WHERE id = NEW.job_id;
  IF job_row.dispatcher_id IS NULL THEN RETURN NEW; END IF;
  SELECT full_name INTO worker_name FROM public.profiles WHERE user_id = NEW.worker_id;

  PERFORM public._notify_telegram_personal(jsonb_build_object(
    'type', 'new_response',
    'user_id', job_row.dispatcher_id,
    'job_id', job_row.id,
    'job_title', job_row.title,
    'worker_name', COALESCE(worker_name, 'Грузчик')
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_personal_new_response ON public.job_responses;
CREATE TRIGGER trg_notify_personal_new_response
  AFTER INSERT ON public.job_responses
  FOR EACH ROW EXECUTE FUNCTION public.notify_personal_new_response();

-- 6. Trigger: worker status change → notify both worker & dispatcher
CREATE OR REPLACE FUNCTION public.notify_personal_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  job_row record;
BEGIN
  IF NEW.worker_status IS NOT DISTINCT FROM OLD.worker_status THEN
    RETURN NEW;
  END IF;
  IF NEW.worker_status IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, dispatcher_id, title INTO job_row FROM public.jobs WHERE id = NEW.job_id;

  -- notify dispatcher
  IF job_row.dispatcher_id IS NOT NULL THEN
    PERFORM public._notify_telegram_personal(jsonb_build_object(
      'type', 'status_change',
      'user_id', job_row.dispatcher_id,
      'job_id', job_row.id,
      'job_title', job_row.title,
      'worker_status', NEW.worker_status,
      'role', 'dispatcher'
    ));
  END IF;

  -- notify worker
  PERFORM public._notify_telegram_personal(jsonb_build_object(
    'type', 'status_change',
    'user_id', NEW.worker_id,
    'job_id', NEW.job_id,
    'job_title', COALESCE(job_row.title, ''),
    'worker_status', NEW.worker_status,
    'role', 'worker'
  ));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_personal_status_change ON public.job_responses;
CREATE TRIGGER trg_notify_personal_status_change
  AFTER UPDATE ON public.job_responses
  FOR EACH ROW EXECUTE FUNCTION public.notify_personal_status_change();

-- 7. Trigger: new job → notify all linked workers personally
CREATE OR REPLACE FUNCTION public.notify_personal_new_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  worker record;
BEGIN
  IF NEW.is_bot = true THEN RETURN NEW; END IF;

  FOR worker IN
    SELECT ts.user_id, ts.chat_id
    FROM public.telegram_subscribers ts
    JOIN public.user_roles ur ON ur.user_id = ts.user_id
    WHERE ts.is_active = true
      AND ts.user_id IS NOT NULL
      AND ur.role = 'worker'::app_role
  LOOP
    PERFORM public._notify_telegram_personal(jsonb_build_object(
      'type', 'new_job',
      'user_id', worker.user_id,
      'job_id', NEW.id,
      'job_title', NEW.title,
      'hourly_rate', NEW.hourly_rate,
      'address', NEW.address
    ));
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_personal_new_job ON public.jobs;
CREATE TRIGGER trg_notify_personal_new_job
  AFTER INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_personal_new_job();
