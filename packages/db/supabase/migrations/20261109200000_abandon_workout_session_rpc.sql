-- Quietly abandon a live session owned by auth.uid() (stale empty / superseded).

create or replace function public.abandon_workout_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.workout_sessions;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_session_id is null then
    raise exception 'session_id is required';
  end if;

  select * into v_session
  from public.workout_sessions s
  where s.id = p_session_id;

  if v_session.id is null then
    raise exception 'Session not found';
  end if;

  if v_session.user_id is distinct from v_uid then
    raise exception 'Not allowed to abandon this session';
  end if;

  if v_session.finished_at is not null then
    return;
  end if;

  update public.workout_sessions
  set finished_at = now()
  where id = p_session_id
    and finished_at is null;
end;
$$;

revoke all on function public.abandon_workout_session(uuid) from public;
revoke all on function public.abandon_workout_session(uuid) from anon;
grant execute on function public.abandon_workout_session(uuid) to authenticated;

notify pgrst, 'reload schema';
