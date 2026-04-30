-- Atomic accept: enforces limit, optionally fills the job and rejects rest
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
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT jr.job_id, jr.worker_id INTO v_job_id, v_worker_id
  FROM public.job_responses jr WHERE jr.id = _response_id;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Response not found';
  END IF;

  SELECT j.dispatcher_id, COALESCE(j.workers_needed, 1)
    INTO v_dispatcher, v_needed
  FROM public.jobs j WHERE j.id = v_job_id
  FOR UPDATE;

  IF v_dispatcher IS NULL OR v_dispatcher <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT count(*)::int INTO v_accepted_count
  FROM public.job_responses
  WHERE job_id = v_job_id AND status = 'accepted';

  IF v_accepted_count >= v_needed THEN
    RAISE EXCEPTION 'Worker limit reached' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.job_responses
  SET status = 'accepted'
  WHERE id = _response_id AND status IS DISTINCT FROM 'accepted';

  v_accepted_count := v_accepted_count + 1;

  IF v_accepted_count >= v_needed THEN
    -- Mark job as filled and auto-reject remaining pending
    UPDATE public.jobs SET status = 'filled' WHERE id = v_job_id AND status = 'active';

    WITH upd AS (
      UPDATE public.job_responses
      SET status = 'rejected'
      WHERE job_id = v_job_id AND status = 'pending'
      RETURNING 1
    )
    SELECT count(*)::int INTO v_auto_rejected FROM upd;

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

-- Prevent new responses to non-active jobs
CREATE OR REPLACE FUNCTION public.prevent_response_to_inactive_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.jobs WHERE id = NEW.job_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Заявка больше не принимает отклики (%)' , v_status USING ERRCODE = 'P0003';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_response_to_inactive_job_trg ON public.job_responses;
CREATE TRIGGER prevent_response_to_inactive_job_trg
BEFORE INSERT ON public.job_responses
FOR EACH ROW EXECUTE FUNCTION public.prevent_response_to_inactive_job();