
-- Fix notify_new_job to use net schema and actual URL
CREATE OR REPLACE FUNCTION public.notify_new_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  RETURN NEW;
END;
$$;

-- Fix notify_new_message to use net schema and actual URL
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://iudtdfznyzpqkfhprbad.supabase.co/functions/v1/send-push',
    body := jsonb_build_object(
      'type', 'new_message',
      'conversation_id', NEW.conversation_id,
      'sender_id', NEW.sender_id,
      'text', NEW.text
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  RETURN NEW;
END;
$$;
