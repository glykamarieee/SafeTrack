-- Removes the activity the unit tests wrote to the live database, 2026-11-12.
--
-- The Jest suites sign in as the unit-test guardians ("UT Guardian A2",
-- "UT Guardian D") and save real rows for their children ("UT Child One",
-- "UT Child Two", "UT Delete Child"): locations at the test coordinates
-- (7.3, 125.4), SOS alerts and safe-zone events. Those rows show up in the
-- admin dashboard totals, Records and reports.
--
-- This deletes only those children's location records, SOS alerts and
-- safety events. The test accounts, children, safe zones and devices stay, so
-- the unit tests still run. Run it after the last test run, before the
-- exhibit or defense; run it again after any later test run.
--
-- Not a migration: run by hand in the Supabase SQL editor. One transaction:
-- if anything fails (for example another table still points at a row),
-- nothing is deleted.

begin;

create temporary table ut_children on commit drop as
select distinct r.child_person_id as child_id
from public.person_relationships r
join public.persons g on g.id = r.guardian_person_id
join public.persons c on c.id = r.child_person_id
where g.full_name like 'UT Guardian%'
  and c.full_name like 'UT %';

do $$
declare
  v_children int;
begin
  select count(*) into v_children from ut_children;
  if v_children = 0 then
    raise exception 'No unit-test children found; nothing was deleted.';
  end if;
  -- Guard against ever matching real families.
  if exists (
    select 1 from ut_children u join public.persons c on c.id = u.child_id
    where c.full_name not like 'UT %'
  ) then
    raise exception 'A matched child is not a unit-test child; nothing was deleted.';
  end if;
end;
$$;

-- What will be removed (shown in the results).
select
  (select count(*) from ut_children) as test_children,
  (select count(*) from public.location_logs l where l.child_id in (select child_id from ut_children)) as location_records,
  (select count(*) from public.sos_alerts s where s.child_id in (select child_id from ut_children)) as sos_alerts,
  (select count(*) from public.geofence_events e where e.child_id in (select child_id from ut_children)) as safety_events;

delete from public.geofence_events where child_id in (select child_id from ut_children);
delete from public.sos_alerts where child_id in (select child_id from ut_children);
delete from public.location_logs where child_id in (select child_id from ut_children);

commit;
