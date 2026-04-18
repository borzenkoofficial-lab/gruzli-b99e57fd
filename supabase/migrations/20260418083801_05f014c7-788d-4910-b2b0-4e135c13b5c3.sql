
CREATE OR REPLACE FUNCTION public.notify_telegram_job_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZHRkZnpueXpwcWtmaHByYmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODQwMzQsImV4cCI6MjA5MDc2MDAzNH0.iorniY3SKOCmyFPoqblZPXXX0P2gnEDLFL5HxaZq9G8';
  significant_change boolean := false;
BEGIN
  IF NEW.is_bot = true THEN
    RETURN NEW;
  END IF;

  -- Only notify if significant fields changed
  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.hourly_rate IS DISTINCT FROM OLD.hourly_rate
     OR NEW.address IS DISTINCT FROM OLD.address
     OR NEW.metro IS DISTINCT FROM OLD.metro
     OR NEW.start_time IS DISTINCT FROM OLD.start_time
     OR NEW.workers_needed IS DISTINCT FROM OLD.workers_needed
     OR NEW.urgent IS DISTINCT FROM OLD.urgent
     OR NEW.quick_minimum IS DISTINCT FROM OLD.quick_minimum
     OR NEW.duration_hours IS DISTINCT FROM OLD.duration_hours
  THEN
    significant_change := true;
  END IF;

  IF NOT significant_change THEN
    RETURN NEW;
  END IF;

  -- Skip if status changed to non-active (closed / deleted)
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://iudtdfznyzpqkfhprbad.supabase.co/functions/v1/notify-telegram-job',
    body := to_jsonb(NEW) || jsonb_build_object('_updated', true),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'apikey', anon_key
    )
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_telegram_job_updated ON public.jobs;

CREATE TRIGGER trg_notify_telegram_job_updated
AFTER UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.notify_telegram_job_updated();
