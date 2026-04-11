-- Allow workers to update their own responses (for worker_status)
CREATE POLICY "Workers can update own response status"
ON public.job_responses
FOR UPDATE
TO authenticated
USING (auth.uid() = worker_id)
WITH CHECK (auth.uid() = worker_id);

-- Trigger function to notify dispatcher when worker status changes
CREATE OR REPLACE FUNCTION public.notify_worker_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire when worker_status actually changed
  IF OLD.worker_status IS DISTINCT FROM NEW.worker_status AND NEW.worker_status IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://iudtdfznyzpqkfhprbad.supabase.co/functions/v1/send-push',
      body := jsonb_build_object(
        'type', 'worker_status_change',
        'job_id', NEW.job_id,
        'worker_id', NEW.worker_id,
        'worker_status', NEW.worker_status
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_worker_status_change
AFTER UPDATE ON public.job_responses
FOR EACH ROW
EXECUTE FUNCTION public.notify_worker_status_change();
