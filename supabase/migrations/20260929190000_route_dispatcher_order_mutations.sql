-- Route remaining dispatcher order mutations through explicit RPCs.
create or replace function public.dispatcher_cancel_job(_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_job public.jobs%rowtype;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if not exists (select 1 from public.user_roles where user_id=v_user and role='dispatcher') then
    raise exception 'dispatcher_role_required' using errcode='42501';
  end if;

  select * into v_job from public.jobs where id=_job_id for update;
  if not found then raise exception 'job_not_found' using errcode='P0002'; end if;
  if v_job.dispatcher_id <> v_user then raise exception 'not_job_dispatcher' using errcode='42501'; end if;
  if v_job.status not in ('open','active','filled') then raise exception 'job_not_cancellable' using errcode='P0001'; end if;

  if exists (
    select 1 from public.job_responses
    where job_id=_job_id and status='accepted' and worker_status <> 'completed'
  ) then
    raise exception 'workers_already_assigned' using errcode='P0001';
  end if;

  update public.jobs set status='closed', updated_at=now() where id=_job_id;
  return jsonb_build_object('job_id',_job_id,'status','closed');
end;
$$;

revoke all on function public.dispatcher_cancel_job(uuid) from public, anon;
grant execute on function public.dispatcher_cancel_job(uuid) to authenticated;
