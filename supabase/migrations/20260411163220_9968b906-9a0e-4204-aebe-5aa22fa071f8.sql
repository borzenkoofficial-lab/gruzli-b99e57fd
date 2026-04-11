
-- Add work tracking fields to job_responses
ALTER TABLE public.job_responses
ADD COLUMN IF NOT EXISTS work_started_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS work_finished_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hours_worked numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS earned integer DEFAULT NULL;

-- Add total_earned to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS total_earned integer DEFAULT 0;
