-- Enforce the dispatcher -> worker boundary when a worker applies to a job.
create or replace function public.worker_submit_response(
  _job_id uuid,
  _message text default null
)
returns public.job_responses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_response public.job_responses%rowtype;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.user_roles
    where user_id = v_user and role = 'worker'
  ) then
    raise exception 'worker_role_required' using errcode = '42501';
  end if;

  select * into v_job from public.jobs where id = _job_id for update;
  if not found then
    raise exception 'job_not_found' using errcode = 'P0002';
  end if;

  if v_job.dispatcher_id is null or v_job.status not in ('active', 'open') then
    raise exception 'job_not_available' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.job_responses
    where job_id = _job_id and worker_id = v_user
      and status in ('pending', 'accepted')
  ) then
    raise exception 'response_already_exists' using errcode = '23505';
  end if;

  insert into public.job_responses (job_id, worker_id, message, status, worker_status)
  values (_job_id, v_user, nullif(trim(_message), ''), 'pending', 'ready')
  returning * into v_response;

  return v_response;
end;
$$;

revoke all on function public.worker_submit_response(uuid,text) from public, anon;
grant execute on function public.worker_submit_response(uuid,text) to authenticated;
