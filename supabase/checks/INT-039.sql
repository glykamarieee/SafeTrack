-- INT-039: The scheduled safety scan turns a missing location (online, but no usable
-- location for 30 minutes) into a "Prolonged inactivity" guardian notice (and a silent watch into INT-038).
select e.event_type,
       count(*)                                                                      as today,
       to_char(max(e.occurred_at) at time zone 'Asia/Manila', 'HH24:MI')             as latest,
       min(e.title)                                                                  as title
from geofence_events e
join smartwatch_devices w on w.child_id = e.child_id
where w.watch_id = 'ST-WATCH-F7MU6729'
  and e.event_type in ('watch_disconnected', 'prolonged_inactivity')
  and e.occurred_at >= date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila'
group by e.event_type;
