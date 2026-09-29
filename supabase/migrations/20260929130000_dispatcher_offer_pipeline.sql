-- Dispatcher proposal and customer selection flow.
-- Keeps existing jobs/job_responses tables; adds only the missing offer entity.

CREATE TABLE IF NOT EXISTS public.dispatcher_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  dispatcher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposed_hourly_rate numeric NOT NULL CHECK (proposed_hourly_rate >= 0),
  proposed_workers integer NOT NULL CHECK (proposed_workers > 0),
  message text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, dispatcher_id)
);

CREATE INDEX IF NOT EXISTS idx_dispatcher_offers_job_status
  ON public.dispatcher_offers(job_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispatcher_offers_dispatcher_status
  ON public.dispatcher_offers(dispatcher_id, status, created_at DESC);

ALTER TABLE public.dispatcher_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dispatchers can view own offers" ON public.dispatcher_offers;
CREATE POLICY "Dispatchers can view own offers"
  ON public.dispatcher_offers FOR SELECT TO authenticated
  USING (dispatcher_id = auth.uid());

DROP POLICY IF EXISTS "Customers can view offers on own jobs" ON public.dispatcher_offers;
CREATE POLICY "Customers can view offers on own jobs"
  ON public.dispatcher_offers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = dispatcher_offers.job_id AND j.client_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.dispatcher_submit_offer(
  _job_id uuid,
  _proposed_hourly_rate numeric,
  _proposed_workers integer,
  _message text DEFAULT NULL
)
RETURNS public.dispatcher_offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.dispatcher_offers;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'dispatcher'
  ) THEN
    RAISE EXCEPTION 'dispatcher_role_required';
  END IF;

  IF _proposed_hourly_rate IS NULL OR _proposed_hourly_rate < 0
     OR _proposed_workers IS NULL OR _proposed_workers < 1 THEN
    RAISE EXCEPTION 'invalid_offer';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = _job_id AND client_id IS NOT NULL
      AND dispatcher_id IS NULL AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'job_unavailable';
  END IF;

  INSERT INTO public.dispatcher_offers
    (job_id, dispatcher_id, proposed_hourly_rate, proposed_workers, message)
  VALUES
    (_job_id, auth.uid(), _proposed_hourly_rate, _proposed_workers,
     NULLIF(trim(_message), ''))
  ON CONFLICT (job_id, dispatcher_id) DO UPDATE
    SET proposed_hourly_rate = EXCLUDED.proposed_hourly_rate,
        proposed_workers = EXCLUDED.proposed_workers,
        message = EXCLUDED.message,
        status = 'pending',
        updated_at = now()
  RETURNING * INTO v_offer;

  RETURN v_offer;
END;
$$;

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
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_offer
  FROM public.dispatcher_offers
  WHERE id = _offer_id
  FOR UPDATE;

  IF v_offer.id IS NULL THEN
    RAISE EXCEPTION 'offer_not_found';
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

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'job_unavailable';
  END IF;

  UPDATE public.dispatcher_offers
  SET status = CASE WHEN id = _offer_id THEN 'accepted' ELSE 'rejected' END,
      updated_at = now()
  WHERE job_id = v_offer.job_id AND status = 'pending';

  RETURN v_job;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dispatcher_submit_offer(uuid,numeric,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_select_dispatcher_offer(uuid) TO authenticated;
