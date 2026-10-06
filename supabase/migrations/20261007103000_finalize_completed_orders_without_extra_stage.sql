-- Production hardening: final settlement is allowed when the assigned
-- workers are all completed. The dispatcher may explicitly enter the
-- finishing stage first, but that intermediate state is not mandatory
-- when every worker has already completed the work.

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
  v_user uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_open integer;
  v_assigned integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode='42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id=v_user AND role='dispatcher'
  ) THEN
    RAISE EXCEPTION 'dispatcher_role_required' USING errcode='42501';
  END IF;

  IF _expense_per_worker < 0 OR _dispatcher_income < 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING errcode='22023';
  END IF;

  SELECT * INTO v_job
  FROM public.jobs
  WHERE id=_job_id
  FOR UPDATE;

  IF NOT FOUND OR v_job.dispatcher_id<>v_user THEN
    RAISE EXCEPTION 'not_job_dispatcher' USING errcode='42501';
  END IF;

  IF v_job.status NOT IN ('active','filled','finishing') THEN
    RAISE EXCEPTION 'job_not_completable' USING errcode='P0001';
  END IF;

  SELECT count(*)
  INTO v_assigned
  FROM public.job_responses
  WHERE job_id=_job_id
    AND status='accepted';

  IF v_assigned = 0 THEN
    RAISE EXCEPTION 'no_assigned_workers' USING errcode='P0001';
  END IF;

  SELECT count(*)
  INTO v_open
  FROM public.job_responses
  WHERE job_id=_job_id
    AND status='accepted'
    AND worker_status IS DISTINCT FROM 'completed';

  IF v_open > 0 THEN
    RAISE EXCEPTION 'workers_not_completed' USING errcode='P0001';
  END IF;

  UPDATE public.jobs
  SET status='completed',
      expense_per_worker=_expense_per_worker,
      dispatcher_income=_dispatcher_income,
      updated_at=now()
  WHERE id=_job_id;

  RETURN jsonb_build_object(
    'job_id',_job_id,
    'status','completed'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dispatcher_complete_job(uuid,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispatcher_complete_job(uuid,numeric,numeric) TO authenticated;
