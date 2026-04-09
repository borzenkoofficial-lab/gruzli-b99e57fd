
-- Add worker_status column for tracking worker state
ALTER TABLE public.job_responses
ADD COLUMN worker_status text DEFAULT null;

-- Enable realtime for job_responses
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_responses;
