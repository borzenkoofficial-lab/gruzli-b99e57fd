-- Drop any existing notification triggers (idempotent)
DROP TRIGGER IF EXISTS on_new_message_notify ON public.messages;
DROP TRIGGER IF EXISTS on_new_job_notify ON public.jobs;
DROP TRIGGER IF EXISTS on_new_message_push4site ON public.messages;
DROP TRIGGER IF EXISTS on_new_job_push4site ON public.jobs;
DROP TRIGGER IF EXISTS on_new_response_push4site ON public.job_responses;
DROP TRIGGER IF EXISTS on_worker_status_change_push ON public.job_responses;

-- Attach native VAPID push triggers
CREATE TRIGGER on_new_message_notify
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

CREATE TRIGGER on_new_job_notify
AFTER INSERT ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.notify_new_job();

-- Trigger for worker status changes -> push to dispatcher/worker
CREATE OR REPLACE FUNCTION public.notify_worker_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZHRkZnpueXpwcWtmaHByYmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODQwMzQsImV4cCI6MjA5MDc2MDAzNH0.iorniY3SKOCmyFPoqblZPXXX0P2gnEDLFL5HxaZq9G8';
BEGIN
  IF NEW.worker_status IS NOT DISTINCT FROM OLD.worker_status THEN RETURN NEW; END IF;
  IF NEW.worker_status IS NULL THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url := 'https://iudtdfznyzpqkfhprbad.supabase.co/functions/v1/send-push',
    body := jsonb_build_object('type','worker_status_change','job_id',NEW.job_id,'worker_id',NEW.worker_id,'worker_status',NEW.worker_status),
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || anon_key, 'apikey', anon_key)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

CREATE TRIGGER on_worker_status_change_push
AFTER UPDATE ON public.job_responses
FOR EACH ROW EXECUTE FUNCTION public.notify_worker_status_change();