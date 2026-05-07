DROP TRIGGER IF EXISTS on_new_job_notify ON public.jobs;
DROP TRIGGER IF EXISTS on_new_message_notify ON public.messages;
DROP TRIGGER IF EXISTS on_worker_status_change_notify ON public.job_responses;

DROP FUNCTION IF EXISTS public.notify_new_job() CASCADE;
DROP FUNCTION IF EXISTS public.notify_new_message() CASCADE;
DROP FUNCTION IF EXISTS public.notify_worker_status_change() CASCADE;

DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
