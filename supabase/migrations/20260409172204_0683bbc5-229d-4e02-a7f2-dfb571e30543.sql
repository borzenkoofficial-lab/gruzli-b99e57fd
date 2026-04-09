
-- Create push subscriptions table
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
ON public.push_subscriptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
ON public.push_subscriptions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
ON public.push_subscriptions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Enable pg_net for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to notify on new jobs
CREATE OR REPLACE FUNCTION public.notify_new_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM extensions.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push',
    body := jsonb_build_object(
      'type', 'new_job',
      'job_id', NEW.id,
      'title', NEW.title,
      'hourly_rate', NEW.hourly_rate,
      'address', NEW.address
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  RETURN NEW;
END;
$$;

-- Function to notify on new messages
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM extensions.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push',
    body := jsonb_build_object(
      'type', 'new_message',
      'conversation_id', NEW.conversation_id,
      'sender_id', NEW.sender_id,
      'text', NEW.text
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  RETURN NEW;
END;
$$;

-- Triggers
CREATE TRIGGER on_new_job_notify
AFTER INSERT ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_job();

CREATE TRIGGER on_new_message_notify
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_message();
