
-- Create triggers for push notifications on new jobs and messages
CREATE TRIGGER on_new_job
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_job();

CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();

-- Allow upsert on push_subscriptions (need UPDATE policy)
CREATE POLICY "Users can update own subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Add unique constraint for upsert to work
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_endpoint_unique UNIQUE (user_id, endpoint);
