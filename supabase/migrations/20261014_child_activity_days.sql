-- Activity History calendar: which Philippine calendar days have records for a
-- child, so the date picker can mark them without downloading every location.
--
-- Run once in the Supabase SQL Editor. It is a single transaction: if any
-- preflight check fails, nothing is changed.

begin;

do $$
begin
  if to_regprocedure('public.is_guardian_of(uuid)') is null then
    raise exception 'Preflight failed: public.is_guardian_of(uuid) does not exist.';
  end if;

  if to_regclass('public.location_logs') is null
     or to_regclass('public.geofence_events') is null
     or to_regclass('public.sos_alerts') is null then
    raise exception 'Preflight failed: location_logs, geofence_events or sos_alerts is missing.';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_my_child_activity_days'
  ) then
    raise exception 'Preflight failed: get_my_child_activity_days already exists.';
  end if;
end;
$$;

create function public.get_my_child_activity_days(
  p_child_id uuid,
  p_from date,
  p_to date
)
returns table (
  day date,
  location_count integer,
  event_count integer,
  sos_count integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_child_id is null or p_from is null or p_to is null then
    raise exception 'A child and a date range are required.' using errcode = '22023';
  end if;

  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'The date range must cover 1 to 63 days.' using errcode = '22023';
  end if;

  if not public.is_guardian_of(p_child_id) then
    raise exception 'You can only view activity for your own children.' using errcode = '42501';
  end if;

  return query
  with bounds as (
    -- Philippine days: midnight in Asia/Manila to the next midnight.
    select
      (p_from::timestamp at time zone 'Asia/Manila') as start_at,
      ((p_to + 1)::timestamp at time zone 'Asia/Manila') as end_at
  ),
  locs as (
    select (ll.recorded_at at time zone 'Asia/Manila')::date as d, count(*)::integer as n
    from public.location_logs ll
    cross join bounds b
    where ll.child_id = p_child_id
      and ll.recorded_at >= b.start_at
      and ll.recorded_at < b.end_at
    group by 1
  ),
  evs as (
    select (ge.occurred_at at time zone 'Asia/Manila')::date as d, count(*)::integer as n
    from public.geofence_events ge
    cross join bounds b
    where ge.child_id = p_child_id
      and ge.occurred_at >= b.start_at
      and ge.occurred_at < b.end_at
    group by 1
  ),
  sos as (
    select (sa.triggered_at at time zone 'Asia/Manila')::date as d, count(*)::integer as n
    from public.sos_alerts sa
    cross join bounds b
    where sa.child_id = p_child_id
      and sa.triggered_at >= b.start_at
      and sa.triggered_at < b.end_at
    group by 1
  ),
  days as (
    select l.d from locs l
    union
    select e.d from evs e
    union
    select s.d from sos s
  )
  select
    dd.d,
    coalesce(l2.n, 0),
    coalesce(e2.n, 0),
    coalesce(s2.n, 0)
  from days dd
  left join locs l2 on l2.d = dd.d
  left join evs e2 on e2.d = dd.d
  left join sos s2 on s2.d = dd.d
  order by dd.d;
end;
$$;

comment on function public.get_my_child_activity_days(uuid, date, date) is
  'Activity History calendar: per Philippine day, the number of location records, safety events and SOS alerts for one of the caller''s children.';

revoke all on function public.get_my_child_activity_days(uuid, date, date) from public, anon;
grant execute on function public.get_my_child_activity_days(uuid, date, date) to authenticated;

commit;
