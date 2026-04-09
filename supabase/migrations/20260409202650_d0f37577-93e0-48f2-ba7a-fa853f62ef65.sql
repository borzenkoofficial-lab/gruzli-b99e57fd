
-- Add premium fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_until timestamp with time zone;

-- Function to count completed jobs this week for a worker
CREATE OR REPLACE FUNCTION public.get_weekly_completed_jobs(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.job_responses
  WHERE worker_id = _user_id
    AND worker_status = 'completed'
    AND created_at >= date_trunc('week', now())
$$;
