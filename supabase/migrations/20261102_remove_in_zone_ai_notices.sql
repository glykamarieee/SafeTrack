-- SafeTrack: remove AI notices raised inside safe zones (2026-11-02)
--
-- Before _shared/anomaly.ts checked safe zones, the AI raised unusual-movement
-- notices for children who were inside their own enabled safe zones. This
-- removes those notices and keeps a copy in geofence_events_removed_ai_notices.
-- Other events and notices outside a safe zone are not touched.
--
-- To undo:
--   insert into public.geofence_events
--   select * from public.geofence_events_removed_ai_notices;

begin;

create table if not exists public.geofence_events_removed_ai_notices
  (like public.geofence_events including all);

-- Internal backup: no policies, so app users can't read it.
alter table public.geofence_events_removed_ai_notices enable row level security;

with removed as (
  delete from public.geofence_events event
  where event.event_type = 'possible_anomaly'
    and exists (
      select 1
      from public.geofences zone
      where zone.child_id = event.child_id
        and zone.is_enabled
        and 2 * 6371000 * asin(sqrt(
          power(sin(radians(zone.latitude - event.latitude) / 2), 2)
          + cos(radians(event.latitude)) * cos(radians(zone.latitude))
            * power(sin(radians(zone.longitude - event.longitude) / 2), 2)
        )) <= zone.radius_meters
    )
  returning event.*
)
insert into public.geofence_events_removed_ai_notices
select * from removed;

commit;
