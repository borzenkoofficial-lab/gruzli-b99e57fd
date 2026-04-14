DROP TRIGGER IF EXISTS on_new_job ON public.jobs;
CREATE TRIGGER on_new_job
AFTER INSERT ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_job();

DROP TRIGGER IF EXISTS on_new_message ON public.messages;
CREATE TRIGGER on_new_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_message();

DROP TRIGGER IF EXISTS on_worker_status_change ON public.job_responses;
CREATE TRIGGER on_worker_status_change
AFTER UPDATE ON public.job_responses
FOR EACH ROW
EXECUTE FUNCTION public.notify_worker_status_change();

ALTER TABLE public.push_subscriptions
DROP CONSTRAINT IF EXISTS push_subscriptions_user_endpoint_unique;

ALTER TABLE public.push_subscriptions
ADD CONSTRAINT push_subscriptions_user_endpoint_unique UNIQUE (user_id, endpoint);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'push_subscriptions'
      AND policyname = 'Users can update own subscriptions'
  ) THEN
    CREATE POLICY "Users can update own subscriptions"
    ON public.push_subscriptions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;