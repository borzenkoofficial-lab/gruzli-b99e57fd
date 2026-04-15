-- Replace the new job trigger to skip bot jobs
CREATE OR REPLACE FUNCTION public.notify_new_job()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZHRkZnpueXpwcWtmaHByYmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODQwMzQsImV4cCI6MjA5MDc2MDAzNH0.iorniY3SKOCmyFPoqblZPXXX0P2gnEDLFL5HxaZq9G8';
BEGIN
  -- Skip bot-generated jobs
  IF NEW.is_bot = true THEN
    RETURN NEW;
  END IF;

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
$function$;