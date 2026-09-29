-- Final launch hardening for the three-role order pipeline.
-- Demo mode is intentionally untouched.

-- Roles are created by the signup trigger. Clients must not be able to
-- self-assign an arbitrary trusted role through RLS.
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;

-- A dispatcher offer can only be selected while it is still pending.
-- This prevents a stale/replayed offer id from being selected twice.
CREATE OR REPLACE FUNCTION public.client_select_dispatcher_offer(_offer_id uuid)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.dispatcher_offers;
  v_job public.jobs;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_offer
  FROM public.dispatcher_offers
  WHERE id = _offer_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'offer_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.jobs
  SET dispatcher_id = v_offer.dispatcher_id,
      hourly_rate = v_offer.proposed_hourly_rate,
      workers_needed = v_offer.proposed_workers,
      status = 'active',
      updated_at = now()
  WHERE id = v_offer.job_id
    AND client_id = auth.uid()
    AND dispatcher_id IS NULL
    AND status = 'open'
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_unavailable' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.dispatcher_offers
  SET status = CASE WHEN id = _offer_id THEN 'accepted' ELSE 'rejected' END,
      updated_at = now()
  WHERE job_id = v_offer.job_id
    AND status = 'pending';

  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.client_select_dispatcher_offer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_select_dispatcher_offer(uuid) TO authenticated;

-- Limit order visibility to users who actually participate in the workflow.
-- Workers see available/active work, dispatchers see available/assigned work,
-- and clients see only their own requests.
DROP POLICY IF EXISTS "Anyone authenticated can view active jobs" ON public.jobs;
CREATE POLICY "Participants can view relevant jobs"
  ON public.jobs FOR SELECT TO authenticated
  USING (
    (
      public.has_role(auth.uid(), 'worker')
      AND status IN ('open', 'active', 'filled')
    )
    OR
    (
      public.has_role(auth.uid(), 'dispatcher')
      AND (
        dispatcher_id = auth.uid()
        OR (dispatcher_id IS NULL AND status = 'open')
      )
    )
    OR
    (
      public.has_role(auth.uid(), 'client')
      AND client_id = auth.uid()
    )
  );
