-- INT-015: Unusual movement found by the AI is saved as a notice for the guardian.
-- Each insert fires the geofence_events_notify_guardian trigger (push to the guardian).
select to_char(e.occurred_at at time zone 'Asia/Manila', 'YYYY-MM-DD HH24:MI') as noticed_at,
       e.title,
       e.anomaly_score,
       e.details
from geofence_events e
join smartwatch_devices w on w.child_id = e.child_id
where w.watch_id = 'ST-WATCH-F7MU6729'
  and e.event_type = 'possible_anomaly'
order by e.occurred_at desc;
