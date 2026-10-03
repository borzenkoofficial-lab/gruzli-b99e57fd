-- Global production hardening: keep dispatcher data edits separate from lifecycle transitions.
-- Status changes must use dedicated lifecycle RPCs.
CREATE OR REPLACE FUNCTION public.dispatcher_update_job(
  _job_id uuid,
  _title text DEFAULT NULL,
  _description text DEFAULT NULL,
  _hourly_rate integer DEFAULT NULL,
  _duration_hours numeric DEFAULT NULL,
  _workers_needed integer DEFAULT NULL,
  _address text DEFAULT NULL,
  _metro text DEFAULT NULL,
  _start_time timestamptz DEFAULT NULL,
  _urgent boolean DEFAULT NULL,
  _quick_minimum boolean DEFAULT NULL,
  _requires_contract boolean DEFAULT NULL,
  _status text DEFAULT NULL
)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_job public.jobs;
  v_accepted_workers integer;
  v_new_workers integer := COALESCE(_workers_needed, 0);
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user AND role = 'dispatcher'
  ) THEN
    RAISE EXCEPTION 'dispatcher_role_required' USING ERRCODE='42501';
  END IF;

  -- Lifecycle state is deliberately not editable through this RPC.
  -- Keep the parameter for API compatibility, but reject every attempt to use it.
  IF _status IS NOT NULL THEN
    RAISE EXCEPTION 'status_must_use_lifecycle_rpc' USING ERRCODE='P0001';
  END IF;

  IF _hourly_rate IS NOT NULL AND _hourly_rate <= 0 THEN
    RAISE EXCEPTION 'invalid_hourly_rate' USING ERRCODE='22023';
  END IF;

  IF _duration_hours IS NOT NULL AND _duration_hours <= 0 THEN
    RAISE EXCEPTION 'invalid_duration' USING ERRCODE='22023';
  END IF;

  IF _workers_needed IS NOT NULL AND _workers_needed < 1 THEN
    RAISE EXCEPTION 'invalid_workers_count' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_job
  FROM public.jobs
  WHERE id = _job_id
    AND dispatcher_id = v_user
    AND status IN ('open','active','filled')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_editable' USING ERRCODE='42501';
  END IF;

  SELECT count(*) INTO v_accepted_workers
  FROM public.job_responses
  WHERE job_id = _job_id
    AND status = 'accepted';

  v_new_workers := COALESCE(_workers_needed, v_job.workers_needed);

  IF v_new_workers < v_accepted_workers THEN
    RAISE EXCEPTION 'workers_below_assigned' USING ERRCODE='P0001';
  END IF;

  UPDATE public.jobs
  SET title = COALESCE(NULLIF(trim(_title), ''), title),
      description = COALESCE(_description, description),
      hourly_rate = COALESCE(_hourly_rate, hourly_rate),
      duration_hours = COALESCE(_duration_hours, duration_hours),
      workers_needed = COALESCE(_workers_needed, workers_needed),
      address = COALESCE(_address, address),
      metro = COALESCE(_metro, metro),
      start_time = COALESCE(_start_time, start_time),
      urgent = COALESCE(_urgent, urgent),
      quick_minimum = COALESCE(_quick_minimum, quick_minimum),
      requires_contract = COALESCE(_requires_contract, requires_contract),
      updated_at = now()
  WHERE id = _job_id;

  SELECT * INTO v_job FROM public.jobs WHERE id = _job_id;
  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatcher_update_job(uuid,text,text,integer,numeric,integer,text,text,timestamptz,boolean,boolean,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispatcher_update_job(uuid,text,text,integer,numeric,integer,text,text,timestamptz,boolean,boolean,boolean,text) TO authenticated;

-- Finishing is a lifecycle transition and therefore requires a live assigned job.
CREATE OR REPLACE FUNCTION public.dispatcher_finish_job(_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_count int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id=v_user AND role='dispatcher'
  ) THEN
    RAISE EXCEPTION 'dispatcher_role_required' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_job
  FROM public.jobs
  WHERE id=_job_id
  FOR UPDATE;

  IF NOT FOUND OR v_job.dispatcher_id <> v_user THEN
    RAISE EXCEPTION 'not_job_dispatcher' USING ERRCODE='42501';
  END IF;

  IF v_job.status NOT IN ('active','filled') THEN
    RAISE EXCEPTION 'job_not_finishable' USING ERRCODE='P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.job_responses
    WHERE job_id=_job_id AND status='accepted'
  ) THEN
    RAISE EXCEPTION 'no_accepted_workers' USING ERRCODE='P0001';
  END IF;

  UPDATE public.job_responses
  SET worker_status='finishing'
  WHERE job_id=_job_id
    AND status='accepted'
    AND worker_status <> 'completed';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.jobs
  SET status='finishing', updated_at=now()
  WHERE id=_job_id;

  RETURN jsonb_build_object(
    'job_id',_job_id,
    'status','finishing',
    'workers_not_completed',v_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dispatcher_finish_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispatcher_finish_job(uuid) TO authenticated;

-- Completion is only valid after dispatcher_finish_job has entered the finishing state.
CREATE OR REPLACE FUNCTION public.dispatcher_complete_job(
  _job_id uuid,
  _expense_per_worker numeric,
  _dispatcher_income numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid:=auth.uid();
  v_job public.jobs%rowtype;
  v_open int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id=v_user AND role='dispatcher'
  ) THEN
    RAISE EXCEPTION 'dispatcher_role_required' USING ERRCODE='42501';
  END IF;

  IF _expense_per_worker < 0 OR _dispatcher_income < 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_job
  FROM public.jobs
  WHERE id=_job_id
  FOR UPDATE;

  IF NOT FOUND OR v_job.dispatcher_id<>v_user THEN
    RAISE EXCEPTION 'not_job_dispatcher' USING ERRCODE='42501';
  END IF;

  IF v_job.status <> 'finishing' THEN
    RAISE EXCEPTION 'job_not_finishing' USING ERRCODE='P0001';
  END IF;

  SELECT count(*) INTO v_open
  FROM public.job_responses
  WHERE job_id=_job_id
    AND status='accepted'
    AND worker_status <> 'completed';

  IF v_open > 0 THEN
    RAISE EXCEPTION 'workers_not_completed' USING ERRCODE='P0001';
  END IF;

  UPDATE public.jobs
  SET status='completed',
      expense_per_worker=_expense_per_worker,
      dispatcher_income=_dispatcher_income,
      updated_at=now()
  WHERE id=_job_id;

  RETURN jsonb_build_object('job_id',_job_id,'status','completed');
END;
$$;

REVOKE ALL ON FUNCTION public.dispatcher_complete_job(uuid,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispatcher_complete_job(uuid,numeric,numeric) TO authenticated;
