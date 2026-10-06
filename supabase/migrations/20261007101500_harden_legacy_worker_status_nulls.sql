-- Production hardening: treat NULL worker status as unfinished.
-- PostgreSQL's "<> 'completed'" is UNKNOWN for NULL and can otherwise
-- bypass dispatcher cancellation/finalization guards on legacy rows.

CREATE OR REPLACE FUNCTION public.dispatcher_finish_job(_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_count integer;
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

  SELECT * INTO v_job
  FROM public.jobs
  WHERE id=_job_id
  FOR UPDATE;

  IF NOT FOUND OR v_job.dispatcher_id<>v_user THEN
    RAISE EXCEPTION 'not_job_dispatcher' USING errcode='42501';
  END IF;

  UPDATE public.job_responses
  SET worker_status='finishing'
  WHERE job_id=_job_id
    AND status='accepted'
    AND worker_status IS DISTINCT FROM 'completed';

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

  IF v_job.status <> 'finishing' THEN
    RAISE EXCEPTION 'job_not_finishing' USING errcode='P0001';
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

CREATE OR REPLACE FUNCTION public.dispatcher_cancel_job(_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_job public.jobs%rowtype;
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

  SELECT * INTO v_job
  FROM public.jobs
  WHERE id=_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_found' USING errcode='P0002';
  END IF;

  IF v_job.dispatcher_id<>v_user THEN
    RAISE EXCEPTION 'not_job_dispatcher' USING errcode='42501';
  END IF;

  IF v_job.status NOT IN ('open','active','filled') THEN
    RAISE EXCEPTION 'job_not_cancellable' USING errcode='P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.job_responses
    WHERE job_id=_job_id
      AND status='accepted'
      AND worker_status IS DISTINCT FROM 'completed'
  ) THEN
    RAISE EXCEPTION 'workers_already_assigned' USING errcode='P0001';
  END IF;

  UPDATE public.jobs
  SET status='closed', updated_at=now()
  WHERE id=_job_id;

  RETURN jsonb_build_object('job_id',_job_id,'status','closed');
END;
$$;

REVOKE ALL ON FUNCTION public.dispatcher_cancel_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispatcher_cancel_job(uuid) TO authenticated;
