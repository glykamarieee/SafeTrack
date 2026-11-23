-- INT-038 / INT-039: The scheduled safety scan turns a silent watch (no contact for
-- 5 minutes) or a missing location (30 minutes) into a guardian notice.
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
