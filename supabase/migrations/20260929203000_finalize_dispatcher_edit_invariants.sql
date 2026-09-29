-- Finalize dispatcher_update_job invariants: this RPC may edit order data,
-- but it must never become a shortcut around the lifecycle RPCs.
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

  IF _status IS NOT NULL AND _status NOT IN ('open','active','filled') THEN
    RAISE EXCEPTION 'invalid_edit_status' USING ERRCODE='22023';
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
      status = COALESCE(_status, status),
      updated_at = now()
  WHERE id = _job_id;

  SELECT * INTO v_job FROM public.jobs WHERE id = _job_id;
  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatcher_update_job(uuid,text,text,integer,numeric,integer,text,text,timestamptz,boolean,boolean,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispatcher_update_job(uuid,text,text,integer,numeric,integer,text,text,timestamptz,boolean,boolean,boolean,text) TO authenticated;
