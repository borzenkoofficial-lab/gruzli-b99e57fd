
-- Add expense_per_worker column to jobs for dispatcher to track costs
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS expense_per_worker integer DEFAULT 0;

-- Add dispatcher_income column to jobs
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS dispatcher_income integer DEFAULT 0;

-- Add review fields to job_responses (worker reviews dispatcher after completion)
ALTER TABLE public.job_responses ADD COLUMN IF NOT EXISTS worker_review_rating integer;
ALTER TABLE public.job_responses ADD COLUMN IF NOT EXISTS worker_review_text text;
ALTER TABLE public.job_responses ADD COLUMN IF NOT EXISTS dispatcher_review_rating integer;
ALTER TABLE public.job_responses ADD COLUMN IF NOT EXISTS dispatcher_review_text text;

-- Create index for faster dispatcher income queries
CREATE INDEX IF NOT EXISTS idx_jobs_dispatcher_status ON public.jobs(dispatcher_id, status);
