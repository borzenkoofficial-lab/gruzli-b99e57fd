-- Harden the dispatcher -> worker staffing boundary.

ALTER TABLE public.job_responses
  ADD COLUMN IF NOT EXISTS agreed_hourly_rate integer;

UPDATE public.job_responses jr
SET agreed_hourly_rate = j.hourly_rate
FROM public.jobs j
WHERE jr.job_id = j.id
  AND jr.agreed_hourly_rate IS NULL;

-- A dispatcher may accept only pending responses belonging to their own assigned job.
-- Repeated acceptance is rejected instead of corrupting the accepted counter.

CREATE OR REPLACE FUNCTION public.accept_job_response(_response_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_worker_id uuid;
  v_dispatcher uuid;
  v_needed integer;
  v_accepted_count integer;
  v_filled boolean := false;
  v_auto_rejected integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'dispatcher'
  ) THEN
    RAISE EXCEPTION 'dispatcher_role_required';
  END IF;

  SELECT jr.job_id, jr.worker_id
  INTO v_job_id, v_worker_id
  FROM public.job_responses jr
  WHERE jr.id = _response_id
  FOR UPDATE;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'response_not_found';
  END IF;

  SELECT j.dispatcher_id, GREATEST(1, COALESCE(j.workers_needed, 1))
  INTO v_dispatcher, v_needed
  FROM public.jobs j
  WHERE j.id = v_job_id
  FOR UPDATE;

  IF v_dispatcher IS NULL OR v_dispatcher <> auth.uid() THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.job_responses
    WHERE id = _response_id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'response_not_pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs
    WHERE id = v_job_id
      AND dispatcher_id = auth.uid()
      AND status IN ('active', 'open')
  ) THEN
    RAISE EXCEPTION 'job_not_available';
  END IF;

  SELECT count(*)::integer
  INTO v_accepted_count
  FROM public.job_responses
  WHERE job_id = v_job_id
    AND status = 'accepted';

  IF v_accepted_count >= v_needed THEN
    RAISE EXCEPTION 'worker_limit_reached' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.job_responses
  SET status = 'accepted',
      worker_status = COALESCE(worker_status, 'ready')
  WHERE id = _response_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'response_not_pending';
  END IF;

  v_accepted_count := v_accepted_count + 1;

  IF v_accepted_count >= v_needed THEN
    UPDATE public.jobs
    SET status = 'filled',
        updated_at = now()
    WHERE id = v_job_id
      AND dispatcher_id = auth.uid()
      AND status IN ('active', 'open');

    WITH upd AS (
      UPDATE public.job_responses
      SET status = 'rejected'
      WHERE job_id = v_job_id
        AND status = 'pending'
      RETURNING 1
    )
    SELECT count(*)::integer INTO v_auto_rejected FROM upd;

    v_filled := true;
  END IF;

  RETURN jsonb_build_object(
    'accepted', true,
    'filled', v_filled,
    'auto_rejected', v_auto_rejected,
    'accepted_count', v_accepted_count,
    'workers_needed', v_needed,
    'job_id', v_job_id,
    'worker_id', v_worker_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_job_response(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_job_response(uuid) TO authenticated;
