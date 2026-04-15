
-- Drop and recreate all triggers to ensure they exist

-- 1. auth.users trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. messages push trigger
DROP TRIGGER IF EXISTS on_new_message_push ON public.messages;
CREATE TRIGGER on_new_message_push
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();

-- 3. jobs push trigger
DROP TRIGGER IF EXISTS on_new_job_push ON public.jobs;
CREATE TRIGGER on_new_job_push
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_job();

-- 4. worker status change push trigger
DROP TRIGGER IF EXISTS on_worker_status_change_push ON public.job_responses;
CREATE TRIGGER on_worker_status_change_push
  AFTER UPDATE ON public.job_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_worker_status_change();

-- 5. display_id trigger
DROP TRIGGER IF EXISTS set_display_id ON public.profiles;
CREATE TRIGGER set_display_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.display_id IS NULL)
  EXECUTE FUNCTION public.generate_display_id();

-- 6. updated_at triggers
DROP TRIGGER IF EXISTS update_jobs_updated_at ON public.jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_kartoteka_updated_at ON public.kartoteka;
CREATE TRIGGER update_kartoteka_updated_at
  BEFORE UPDATE ON public.kartoteka
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Add last_read_at column
ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz DEFAULT now();

-- 8. RLS policy for updating read status
DROP POLICY IF EXISTS "Participants can update own read status" ON public.conversation_participants;
CREATE POLICY "Participants can update own read status"
  ON public.conversation_participants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
