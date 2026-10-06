-- Gruzli production hardening: real backend boundary, profile privacy, safe chat creation,
-- response-rate snapshots and controlled dispatcher republish.

ALTER TABLE public.job_responses
  ADD COLUMN IF NOT EXISTS agreed_hourly_rate integer;

UPDATE public.job_responses jr
SET agreed_hourly_rate = j.hourly_rate
FROM public.jobs j
WHERE jr.job_id = j.id
  AND jr.agreed_hourly_rate IS NULL;

CREATE OR REPLACE FUNCTION public.worker_submit_response(
  _job_id uuid,
  _message text DEFAULT NULL
)
RETURNS public.job_responses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_response public.job_responses%rowtype;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user AND role = 'worker'
  ) THEN
    RAISE EXCEPTION 'worker_role_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_job.dispatcher_id IS NULL OR v_job.status NOT IN ('active', 'open') THEN
    RAISE EXCEPTION 'job_not_available' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.job_responses
    WHERE job_id = _job_id AND worker_id = v_user
      AND status IN ('pending', 'accepted')
  ) THEN
    RAISE EXCEPTION 'response_already_exists' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.job_responses (
    job_id, worker_id, message, status, worker_status, agreed_hourly_rate
  )
  VALUES (
    _job_id, v_user, NULLIF(trim(_message), ''), 'pending', 'ready',
    v_job.hourly_rate
  )
  RETURNING * INTO v_response;

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.worker_submit_response(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.worker_submit_response(uuid,text) TO authenticated;

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
  v_rate integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'dispatcher'
  ) THEN
    RAISE EXCEPTION 'dispatcher_role_required';
  END IF;

  SELECT jr.job_id, jr.worker_id INTO v_job_id, v_worker_id
  FROM public.job_responses jr WHERE jr.id = _response_id FOR UPDATE;
  IF v_job_id IS NULL THEN RAISE EXCEPTION 'response_not_found'; END IF;

  SELECT j.dispatcher_id, GREATEST(1, COALESCE(j.workers_needed,1)), j.hourly_rate
  INTO v_dispatcher, v_needed, v_rate
  FROM public.jobs j WHERE j.id = v_job_id FOR UPDATE;

  IF v_dispatcher IS NULL OR v_dispatcher <> auth.uid() THEN RAISE EXCEPTION 'access_denied'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.job_responses WHERE id = _response_id AND status = 'pending'
  ) THEN RAISE EXCEPTION 'response_not_pending'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = v_job_id AND dispatcher_id = auth.uid() AND status IN ('active','open')
  ) THEN RAISE EXCEPTION 'job_not_available'; END IF;

  SELECT count(*)::integer INTO v_accepted_count
  FROM public.job_responses WHERE job_id = v_job_id AND status = 'accepted';

  IF v_accepted_count >= v_needed THEN RAISE EXCEPTION 'worker_limit_reached' USING ERRCODE='P0002'; END IF;

  UPDATE public.job_responses
  SET status = 'accepted',
      worker_status = COALESCE(worker_status, 'ready'),
      agreed_hourly_rate = COALESCE(agreed_hourly_rate, v_rate)
  WHERE id = _response_id AND status = 'pending';

  IF NOT FOUND THEN RAISE EXCEPTION 'response_not_pending'; END IF;

  v_accepted_count := v_accepted_count + 1;

  IF v_accepted_count >= v_needed THEN
    UPDATE public.jobs
    SET status = 'filled', updated_at = now()
    WHERE id = v_job_id AND dispatcher_id = auth.uid() AND status IN ('active','open');

    WITH upd AS (
      UPDATE public.job_responses SET status='rejected'
      WHERE job_id=v_job_id AND status='pending' RETURNING 1
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

REVOKE ALL ON FUNCTION public.accept_job_response(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_job_response(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.worker_update_response_status(
  _response_id uuid,
  _next_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_response public.job_responses%rowtype;
  v_now timestamptz := now();
  v_hours numeric;
  v_earned numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_response
  FROM public.job_responses
  WHERE id = _response_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'response_not_found' USING ERRCODE='P0002'; END IF;
  IF v_response.worker_id <> v_user THEN RAISE EXCEPTION 'not_response_owner' USING ERRCODE='42501'; END IF;
  IF v_response.status <> 'accepted' THEN RAISE EXCEPTION 'response_not_accepted' USING ERRCODE='P0001'; END IF;

  IF _next_status = 'confirmed' THEN
    IF v_response.worker_status IS NOT NULL AND v_response.worker_status NOT IN ('ready') THEN
      RAISE EXCEPTION 'invalid_transition';
    END IF;
    UPDATE public.job_responses SET worker_status='confirmed' WHERE id=_response_id;

  ELSIF _next_status='en_route' THEN
    IF v_response.worker_status NOT IN ('confirmed','late') THEN RAISE EXCEPTION 'invalid_transition'; END IF;
    UPDATE public.job_responses SET worker_status='en_route' WHERE id=_response_id;

  ELSIF _next_status='late' THEN
    IF v_response.worker_status NOT IN ('confirmed','en_route','late') THEN RAISE EXCEPTION 'invalid_transition'; END IF;
    UPDATE public.job_responses SET worker_status='late' WHERE id=_response_id;

  ELSIF _next_status='arrived' THEN
    IF v_response.worker_status NOT IN ('en_route','late') THEN RAISE EXCEPTION 'invalid_transition'; END IF;
    UPDATE public.job_responses
    SET worker_status='arrived', work_started_at=coalesce(work_started_at,v_now)
    WHERE id=_response_id;

  ELSIF _next_status='completed' THEN
    IF v_response.worker_status NOT IN ('arrived','finishing') THEN RAISE EXCEPTION 'invalid_transition'; END IF;
    IF v_response.work_started_at IS NULL THEN RAISE EXCEPTION 'work_not_started'; END IF;

    v_hours := greatest(0.5, round(extract(epoch from (v_now-v_response.work_started_at))/3600.0,1));
    v_earned := round(v_hours * coalesce(v_response.agreed_hourly_rate,0));

    UPDATE public.job_responses
    SET worker_status='completed',
        work_finished_at=v_now,
        hours_worked=v_hours,
        earned=v_earned
    WHERE id=_response_id;

    UPDATE public.profiles
    SET completed_orders=coalesce(completed_orders,0)+1,
        total_earned=coalesce(total_earned,0)+v_earned
    WHERE user_id=v_user;
  ELSE
    RAISE EXCEPTION 'unsupported_status';
  END IF;

  RETURN jsonb_build_object(
    'response_id',_response_id,
    'worker_status',_next_status,
    'work_started_at',(SELECT work_started_at FROM public.job_responses WHERE id=_response_id),
    'work_finished_at',(SELECT work_finished_at FROM public.job_responses WHERE id=_response_id),
    'hours_worked',(SELECT hours_worked FROM public.job_responses WHERE id=_response_id),
    'earned',(SELECT earned FROM public.job_responses WHERE id=_response_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.worker_update_response_status(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.worker_update_response_status(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.dispatcher_republish_job(_job_id uuid)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_job public.jobs;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='dispatcher'
  ) THEN RAISE EXCEPTION 'dispatcher_role_required' USING ERRCODE='42501'; END IF;

  UPDATE public.jobs
  SET status='active', updated_at=now()
  WHERE id=_job_id
    AND dispatcher_id=auth.uid()
    AND status='closed'
    AND NOT EXISTS (
      SELECT 1 FROM public.job_responses
      WHERE job_id=_job_id AND status='accepted'
    )
  RETURNING * INTO v_job;

  IF NOT FOUND THEN RAISE EXCEPTION 'job_not_republishable' USING ERRCODE='P0001'; END IF;
  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatcher_republish_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispatcher_republish_job(uuid) TO authenticated;

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
  v_user uuid:=auth.uid();
  v_job public.jobs;
  v_accepted_workers integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_user AND role='dispatcher') THEN
    RAISE EXCEPTION 'dispatcher_role_required' USING ERRCODE='42501';
  END IF;
  IF _status IS NOT NULL AND _status NOT IN ('open','active','filled') THEN RAISE EXCEPTION 'invalid_edit_status'; END IF;
  IF _hourly_rate IS NOT NULL AND _hourly_rate <= 0 THEN RAISE EXCEPTION 'invalid_hourly_rate'; END IF;
  IF _duration_hours IS NOT NULL AND _duration_hours <= 0 THEN RAISE EXCEPTION 'invalid_duration'; END IF;
  IF _workers_needed IS NOT NULL AND _workers_needed < 1 THEN RAISE EXCEPTION 'invalid_workers_count'; END IF;

  SELECT * INTO v_job FROM public.jobs
  WHERE id=_job_id AND dispatcher_id=v_user AND status IN ('open','active','filled')
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_not_editable' USING ERRCODE='42501'; END IF;

  SELECT count(*) INTO v_accepted_workers
  FROM public.job_responses WHERE job_id=_job_id AND status='accepted';

  IF _hourly_rate IS NOT NULL AND _hourly_rate IS DISTINCT FROM v_job.hourly_rate
     AND EXISTS (
       SELECT 1 FROM public.job_responses
       WHERE job_id=_job_id AND status IN ('pending','accepted')
     )
  THEN
    RAISE EXCEPTION 'hourly_rate_locked' USING ERRCODE='P0001';
  END IF;

  IF COALESCE(_workers_needed,v_job.workers_needed) < v_accepted_workers THEN
    RAISE EXCEPTION 'workers_below_assigned' USING ERRCODE='P0001';
  END IF;

  IF _status IS NOT NULL AND _status IS DISTINCT FROM v_job.status THEN
    RAISE EXCEPTION 'lifecycle_managed_status' USING ERRCODE='P0001';
  END IF;

  UPDATE public.jobs
  SET title=COALESCE(NULLIF(trim(_title),''),title),
      description=COALESCE(_description,description),
      hourly_rate=COALESCE(_hourly_rate,hourly_rate),
      duration_hours=COALESCE(_duration_hours,duration_hours),
      workers_needed=COALESCE(_workers_needed,workers_needed),
      address=COALESCE(_address,address),
      metro=COALESCE(_metro,metro),
      start_time=COALESCE(_start_time,start_time),
      urgent=COALESCE(_urgent,urgent),
      quick_minimum=COALESCE(_quick_minimum,quick_minimum),
      requires_contract=COALESCE(_requires_contract,requires_contract),
      status=COALESCE(_status,status),
      updated_at=now()
  WHERE id=_job_id;

  SELECT * INTO v_job FROM public.jobs WHERE id=_job_id;
  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatcher_update_job(uuid,text,text,integer,numeric,integer,text,text,timestamptz,boolean,boolean,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispatcher_update_job(uuid,text,text,integer,numeric,integer,text,text,timestamptz,boolean,boolean,boolean,text) TO authenticated;

-- User profile privacy: only the owner can read their private profile.
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.profile_self_update_allowed(
  _user_id uuid,
  _rating numeric,
  _completed_orders integer,
  _total_earned integer,
  _balance integer,
  _blocked boolean,
  _is_premium boolean,
  _premium_until timestamptz,
  _verified boolean,
  _recovery_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v public.profiles;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN RETURN false; END IF;
  SELECT * INTO v FROM public.profiles WHERE user_id=_user_id;
  IF NOT FOUND THEN RETURN false; END IF;

  RETURN _rating IS NOT DISTINCT FROM v.rating
     AND _completed_orders IS NOT DISTINCT FROM v.completed_orders
     AND _total_earned IS NOT DISTINCT FROM v.total_earned
     AND _balance IS NOT DISTINCT FROM v.balance
     AND _blocked IS NOT DISTINCT FROM v.blocked
     AND _is_premium IS NOT DISTINCT FROM v.is_premium
     AND _premium_until IS NOT DISTINCT FROM v.premium_until
     AND _verified IS NOT DISTINCT FROM v.verified
     AND _recovery_code IS NOT DISTINCT FROM v.recovery_code;
END;
$$;

REVOKE ALL ON FUNCTION public.profile_self_update_allowed(uuid,numeric,integer,integer,integer,boolean,boolean,timestamptz,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_self_update_allowed(uuid,numeric,integer,integer,integer,boolean,boolean,timestamptz,boolean,text) TO authenticated;

CREATE POLICY "Users can update safe profile fields"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    public.profile_self_update_allowed(
      user_id, rating, completed_orders, total_earned, balance,
      blocked, is_premium, premium_until, verified, recovery_code
    )
  );

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_admin boolean;
  v_total integer;
  v_online integer;
  v_today integer;
  v_week integer;
  v_avg numeric;
  v_ratings integer;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin'
  ) INTO v_admin;
  IF NOT v_admin THEN RAISE EXCEPTION 'admin_role_required' USING ERRCODE='42501'; END IF;

  SELECT count(*) INTO v_total FROM public.profiles;
  SELECT count(*) INTO v_online FROM public.profiles WHERE last_seen_at >= now()-interval '2 minutes';
  SELECT count(*) INTO v_today FROM public.profiles WHERE created_at >= date_trunc('day', now());
  SELECT count(*) INTO v_week FROM public.profiles WHERE created_at >= now()-interval '7 days';
  SELECT coalesce(avg(rating),0), count(*) INTO v_avg,v_ratings FROM public.app_ratings;

  RETURN jsonb_build_object(
    'totalUsers',v_total,'onlineNow',v_online,'newToday',v_today,
    'newThisWeek',v_week,'avgRating',round(v_avg,1),'totalRatings',v_ratings
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

DROP POLICY IF EXISTS "Admins can view app ratings" ON public.app_ratings;
CREATE POLICY "Admins can view app ratings"
  ON public.app_ratings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.create_direct_conversation(
  _other_user_id uuid,
  _title text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_user uuid:=auth.uid();
  v_existing uuid;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
  IF _other_user_id IS NULL OR _other_user_id=v_user THEN RAISE EXCEPTION 'invalid_participant' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=_other_user_id) THEN RAISE EXCEPTION 'participant_not_found' USING ERRCODE='P0002'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (blocker_id=v_user AND blocked_id=_other_user_id)
       OR (blocker_id=_other_user_id AND blocked_id=v_user)
  ) THEN
    RAISE EXCEPTION 'conversation_blocked' USING ERRCODE='42501';
  END IF;

  SELECT c.id INTO v_existing
  FROM public.conversations c
  JOIN public.conversation_participants a ON a.conversation_id=c.id AND a.user_id=v_user
  JOIN public.conversation_participants b ON b.conversation_id=c.id AND b.user_id=_other_user_id
  WHERE coalesce(c.is_group,false)=false
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO public.conversations(title,is_group)
  VALUES (coalesce(nullif(trim(_title),''),'Чат'),false)
  RETURNING id INTO v_id;

  INSERT INTO public.conversation_participants(conversation_id,user_id)
  VALUES (v_id,v_user),(v_id,_other_user_id);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_direct_conversation(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_direct_conversation(uuid,text) TO authenticated;

DROP POLICY IF EXISTS "Authenticated can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated can add participants" ON public.conversation_participants;



-- Conversations and participants are created only by the secured direct-chat RPC.
REVOKE INSERT, UPDATE, DELETE ON public.conversations FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.conversation_participants FROM authenticated;
REVOKE UPDATE, DELETE ON public.messages FROM authenticated;
