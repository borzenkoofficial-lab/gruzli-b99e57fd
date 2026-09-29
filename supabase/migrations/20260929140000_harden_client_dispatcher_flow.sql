-- Harden role checks and prevent bypassing customer selection.
-- Roles are sourced from the trusted user_roles table, not editable JWT user_metadata.

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

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'client'
  ) THEN
    RAISE EXCEPTION 'client_role_required';
  END IF;

  IF NULLIF(trim(_title), '') IS NULL THEN
    RAISE EXCEPTION 'title_required';
  END IF;

  IF _hourly_rate IS NULL OR _hourly_rate < 0
     OR _duration_hours IS NULL OR _duration_hours <= 0
     OR _workers_needed IS NULL OR _workers_needed < 1 THEN
    RAISE EXCEPTION 'invalid_job_parameters';
  END IF;

  INSERT INTO public.jobs (
    client_id, dispatcher_id, title, description, hourly_rate, start_time,
    duration_hours, address, metro, workers_needed, urgent, quick_minimum,
    requires_contract, status
  ) VALUES (
    auth.uid(), NULL, trim(_title), NULLIF(trim(_description), ''), _hourly_rate,
    _start_time, _duration_hours, NULLIF(trim(_address), ''),
    NULLIF(trim(_metro), ''), _workers_needed,
    COALESCE(_urgent, false), COALESCE(_quick_minimum, false),
    COALESCE(_requires_contract, false), 'open'
  )
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

-- Keep the old RPC name for compatibility, but reject direct assignment.
-- Dispatchers must submit an offer and be selected by the customer.
CREATE OR REPLACE FUNCTION public.dispatcher_claim_job(_job_id uuid)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'dispatcher'
  ) THEN
    RAISE EXCEPTION 'dispatcher_role_required';
  END IF;

  RAISE EXCEPTION 'submit_dispatcher_offer_instead';
END;
$$;
