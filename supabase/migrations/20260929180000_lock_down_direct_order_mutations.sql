-- Lock the three-role workflow at the RLS layer.
-- State-changing order operations must use the hardened SECURITY DEFINER RPCs.

-- A dispatcher must not create or directly mutate jobs. The customer creates the
-- request and the selected dispatcher is assigned by client_select_dispatcher_offer.
DROP POLICY IF EXISTS "Dispatchers can create jobs" ON public.jobs;
DROP POLICY IF EXISTS "Dispatchers can update own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Dispatchers can delete own jobs" ON public.jobs;

-- Workers can read their own responses and dispatchers can read responses for
-- their assigned jobs, but neither side can mutate job_responses directly.
-- Inserts/updates are performed by worker_submit_response, accept_job_response,
-- worker_update_response_status, worker_withdraw_response and dispatcher_reject_job_response.
DROP POLICY IF EXISTS "Workers can create responses" ON public.job_responses;
DROP POLICY IF EXISTS "Dispatchers can update response status" ON public.job_responses;

-- Explicit deny-style policies are unnecessary: with the mutating policies
-- removed, PostgreSQL RLS denies those operations for authenticated clients.
