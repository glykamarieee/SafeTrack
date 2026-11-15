-- TEST DATA ONLY (2026-11-15): two AI notices for the unit-test child "UT Child One", so the
-- notice SCREENS can be tested (CASE-065 to CASE-072). The AI itself is tested by CASE-058 to 062.
-- Same title and wording as the real AI pipeline (supabase/functions/_shared/anomaly.ts).
-- Push notifications are switched off while inserting, so no phone is notified.
-- Run once in Supabase > SQL Editor. Safe to re-run: it adds nothing if the test notices exist.
begin;

do $$
declare
  v_child uuid;
  v_count int;
begin
  select count(*) into v_count from public.persons where full_name = 'UT Child One' and is_active;
  if v_count <> 1 then
    raise exception 'Expected exactly one active "UT Child One", found %', v_count;
  end if;
  select id into v_child from public.persons where full_name = 'UT Child One' and is_active;

  if exists (select 1 from public.geofence_events where child_id = v_child and event_type = 'possible_anomaly') then
    raise notice 'UT Child One already has AI notices; nothing added.';
    return;
  end if;

  alter table public.geofence_events disable trigger geofence_events_notify_guardian;

  insert into public.geofence_events (child_id, event_type, title, details, anomaly_score, latitude, longitude, occurred_at)
  values
    -- With listed reasons and a score (like the real 40 km jump result in CASE-060).
    (v_child, 'possible_anomaly', 'Unusual movement notice',
     'Possible unusual movement: unusually high travel speed, large distance from the previous location. Advisory only.',
     0.71, 14.98000, 121.00000, now() - interval '2 hours'),
    -- Without separate reasons (CASE-072).
    (v_child, 'possible_anomaly', 'Unusual movement notice',
     'Possible unusual movement detected from available location history. Advisory only.',
     0.62, 14.97000, 121.01000, now() - interval '1 hour');

  alter table public.geofence_events enable trigger geofence_events_notify_guardian;
  raise notice 'Added 2 test AI notices for UT Child One.';
end $$;

select count(*) as ut_child_one_ai_notices
from public.geofence_events e join public.persons p on p.id = e.child_id
where p.full_name = 'UT Child One' and e.event_type = 'possible_anomaly';

commit;
