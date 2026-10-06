-- Gruzli three-role order pipeline
-- client = customer who requests workers
-- dispatcher = operator who accepts and staffs the request
-- worker = executor

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.jobs
  ALTER COLUMN dispatcher_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON public.jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_dispatcher_status ON public.jobs(dispatcher_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_open_requests ON public.jobs(status, dispatcher_id) WHERE dispatcher_id IS NULL;

CREATE OR REPLACE FUNCTION public.client_create_job(
  _title text,
  _description text,
  _hourly_rate numeric,
  _start_time timestamptz,
  _duration_hours numeric,
  _address text,
  _metro text,
  _workers_needed integer,
  _urgent boolean DEFAULT false,
  _quick_minimum boolean DEFAULT false,
  _requires_contract boolean DEFAULT false
)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') <> 'client' THEN
    RAISE EXCEPTION 'client_role_required';
  END IF;

  INSERT INTO public.jobs (
    client_id, dispatcher_id, title, description, hourly_rate, start_time,
    duration_hours, address, metro, workers_needed, urgent, quick_minimum,
    requires_contract, status
  ) VALUES (
    auth.uid(), NULL, trim(_title), NULLIF(trim(_description), ''), _hourly_rate,
    _start_time, _duration_hours, NULLIF(trim(_address), ''),
    NULLIF(trim(_metro), ''), GREATEST(1, COALESCE(_workers_needed, 1)),
    COALESCE(_urgent, false), COALESCE(_quick_minimum, false),
    COALESCE(_requires_contract, false), 'open'
  )
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatcher_claim_job(_job_id uuid)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'dispatcher'
  ) THEN
    RAISE EXCEPTION 'dispatcher_role_required';
  END IF;

  UPDATE public.jobs
  SET dispatcher_id = auth.uid(), status = COALESCE(status, 'open'), updated_at = now()
  WHERE id = _job_id AND dispatcher_id IS NULL
  RETURNING * INTO v_job;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'job_unavailable';
  END IF;

  RETURN v_job;
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_create_job(text,text,numeric,timestamptz,numeric,text,text,integer,boolean,boolean,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispatcher_claim_job(uuid) TO authenticated;
