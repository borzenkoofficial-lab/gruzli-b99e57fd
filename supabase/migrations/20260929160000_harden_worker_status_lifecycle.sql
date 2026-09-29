-- Controlled worker/dispatcher lifecycle for the Gruzli order pipeline.
-- All state-changing operations go through SECURITY DEFINER RPCs.

create or replace function public.worker_update_response_status(
  _response_id uuid,
  _next_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_response public.job_responses%rowtype;
  v_now timestamptz := now();
  v_hours numeric;
  v_earned numeric;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '42501'; end if;

  select * into v_response
  from public.job_responses
  where id = _response_id
  for update;

  if not found then raise exception 'response_not_found' using errcode = 'P0002'; end if;
  if v_response.worker_id <> v_user then raise exception 'not_response_owner' using errcode = '42501'; end if;
  if v_response.status <> 'accepted' then raise exception 'response_not_accepted' using errcode = 'P0001'; end if;

  if _next_status = 'confirmed' then
    if v_response.worker_status is not null and v_response.worker_status not in ('ready') then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.job_responses set worker_status = 'confirmed' where id = _response_id;

  elsif _next_status = 'en_route' then
    if v_response.worker_status <> 'confirmed' and v_response.worker_status <> 'late' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.job_responses set worker_status = 'en_route' where id = _response_id;

  elsif _next_status = 'late' then
    if v_response.worker_status not in ('confirmed','en_route','late') then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.job_responses set worker_status = 'late' where id = _response_id;

  elsif _next_status = 'arrived' then
    if v_response.worker_status not in ('en_route','late') then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.job_responses
      set worker_status = 'arrived',
          work_started_at = coalesce(work_started_at, v_now)
      where id = _response_id;

  elsif _next_status = 'completed' then
    if v_response.worker_status not in ('arrived','finishing') then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    if v_response.work_started_at is null then
      raise exception 'work_not_started' using errcode = 'P0001';
    end if;

    v_hours := greatest(0.5, round(extract(epoch from (v_now - v_response.work_started_at)) / 3600.0, 1));
    v_earned := round(v_hours * coalesce(v_response.hourly_rate, 0));

    update public.job_responses
      set worker_status = 'completed',
          work_finished_at = v_now,
          hours_worked = v_hours,
          earned = v_earned
      where id = _response_id;

    update public.profiles
      set completed_orders = coalesce(completed_orders, 0) + 1,
          total_earned = coalesce(total_earned, 0) + v_earned
      where user_id = v_user;
  else
    raise exception 'unsupported_status' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'response_id', _response_id,
    'worker_status', _next_status,
    'work_started_at', (select work_started_at from public.job_responses where id = _response_id),
    'work_finished_at', (select work_finished_at from public.job_responses where id = _response_id),
    'hours_worked', (select hours_worked from public.job_responses where id = _response_id),
    'earned', (select earned from public.job_responses where id = _response_id)
  );
end;
$$;

create or replace function public.worker_withdraw_response(_response_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid := auth.uid(); v_status text;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select status into v_status from public.job_responses where id=_response_id and worker_id=v_user for update;
  if not found then raise exception 'response_not_found' using errcode = 'P0002'; end if;
  if v_status <> 'pending' then raise exception 'cannot_withdraw' using errcode = 'P0001'; end if;
  update public.job_responses set status='withdrawn' where id=_response_id;
  return jsonb_build_object('response_id',_response_id,'status','withdrawn');
end;
$$;

create or replace function public.dispatcher_reject_job_response(_response_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid := auth.uid(); v_response public.job_responses%rowtype; v_job public.jobs%rowtype;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if not exists (select 1 from public.user_roles where user_id=v_user and role='dispatcher') then
    raise exception 'dispatcher_role_required' using errcode='42501';
  end if;
  select * into v_response from public.job_responses where id=_response_id for update;
  if not found then raise exception 'response_not_found' using errcode='P0002'; end if;
  select * into v_job from public.jobs where id=v_response.job_id for update;
  if not found or v_job.dispatcher_id <> v_user then raise exception 'not_job_dispatcher' using errcode='42501'; end if;
  if v_response.status <> 'pending' then raise exception 'response_not_pending' using errcode='P0001'; end if;
  update public.job_responses set status='rejected' where id=_response_id;
  return jsonb_build_object('response_id',_response_id,'status','rejected');
end;
$$;

create or replace function public.dispatcher_finish_job(_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid:=auth.uid(); v_job public.jobs%rowtype; v_count int;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if not exists (select 1 from public.user_roles where user_id=v_user and role='dispatcher') then
    raise exception 'dispatcher_role_required' using errcode='42501';
  end if;
  select * into v_job from public.jobs where id=_job_id for update;
  if not found or v_job.dispatcher_id<>v_user then raise exception 'not_job_dispatcher' using errcode='42501'; end if;
  update public.job_responses
    set worker_status='finishing'
    where job_id=_job_id and status='accepted' and worker_status<>'completed';
  get diagnostics v_count = row_count;
  update public.jobs set status='finishing' where id=_job_id;
  return jsonb_build_object('job_id',_job_id,'status','finishing','workers_not_completed',v_count);
end;
$$;

create or replace function public.dispatcher_complete_job(
  _job_id uuid,
  _expense_per_worker numeric,
  _dispatcher_income numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid:=auth.uid(); v_job public.jobs%rowtype; v_open int;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if not exists (select 1 from public.user_roles where user_id=v_user and role='dispatcher') then
    raise exception 'dispatcher_role_required' using errcode='42501';
  end if;
  if _expense_per_worker < 0 or _dispatcher_income < 0 then raise exception 'invalid_amount' using errcode='22023'; end if;
  select * into v_job from public.jobs where id=_job_id for update;
  if not found or v_job.dispatcher_id<>v_user then raise exception 'not_job_dispatcher' using errcode='42501'; end if;

  select count(*) into v_open
  from public.job_responses
  where job_id=_job_id and status='accepted' and worker_status <> 'completed';

  if v_open > 0 then raise exception 'workers_not_completed' using errcode='P0001'; end if;

  update public.jobs
    set status='completed',
        expense_per_worker=_expense_per_worker,
        dispatcher_income=_dispatcher_income
    where id=_job_id;

  return jsonb_build_object('job_id',_job_id,'status','completed');
end;
$$;

revoke all on function public.worker_update_response_status(uuid,text) from public, anon;
revoke all on function public.worker_withdraw_response(uuid) from public, anon;
revoke all on function public.dispatcher_reject_job_response(uuid) from public, anon;
revoke all on function public.dispatcher_finish_job(uuid) from public, anon;
revoke all on function public.dispatcher_complete_job(uuid,numeric,numeric) from public, anon;

grant execute on function public.worker_update_response_status(uuid,text) to authenticated;
grant execute on function public.worker_withdraw_response(uuid) to authenticated;
grant execute on function public.dispatcher_reject_job_response(uuid) to authenticated;
grant execute on function public.dispatcher_finish_job(uuid) to authenticated;
grant execute on function public.dispatcher_complete_job(uuid,numeric,numeric) to authenticated;


create or replace function public.dispatcher_review_worker(
  _response_id uuid,
  _rating integer,
  _text text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid:=auth.uid(); v_response public.job_responses%rowtype; v_job public.jobs%rowtype;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if not exists (select 1 from public.user_roles where user_id=v_user and role='dispatcher') then
    raise exception 'dispatcher_role_required' using errcode='42501';
  end if;
  if _rating < 1 or _rating > 5 then raise exception 'invalid_rating' using errcode='22023'; end if;
  select * into v_response from public.job_responses where id=_response_id for update;
  if not found then raise exception 'response_not_found' using errcode='P0002'; end if;
  select * into v_job from public.jobs where id=v_response.job_id for update;
  if not found or v_job.dispatcher_id<>v_user then raise exception 'not_job_dispatcher' using errcode='42501'; end if;
  if v_response.worker_status <> 'completed' then raise exception 'worker_not_completed' using errcode='P0001'; end if;
  update public.job_responses
    set dispatcher_review_rating=_rating,
        dispatcher_review_text=nullif(trim(_text),'')
    where id=_response_id;
  return jsonb_build_object('response_id',_response_id,'rating',_rating);
end;
$$;

revoke all on function public.dispatcher_review_worker(uuid,integer,text) from public, anon;
grant execute on function public.dispatcher_review_worker(uuid,integer,text) to authenticated;
