-- Restore triggers that were lost

-- 1. Profile creation on new user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. Push notification on new job
CREATE OR REPLACE TRIGGER on_new_job_push
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_job();

-- 3. Push notification on new message
CREATE OR REPLACE TRIGGER on_new_message_push
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();

-- 4. Push notification on worker status change
CREATE OR REPLACE TRIGGER on_worker_status_change_push
  AFTER UPDATE ON public.job_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_worker_status_change();

-- 5. Auto-generate display_id for profiles
CREATE OR REPLACE TRIGGER set_display_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.display_id IS NULL)
  EXECUTE FUNCTION public.generate_display_id();

-- 6. Auto-update updated_at on jobs
CREATE OR REPLACE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Auto-update updated_at on profiles
CREATE OR REPLACE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();