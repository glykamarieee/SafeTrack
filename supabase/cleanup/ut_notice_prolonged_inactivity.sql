-- Unit testing (Notification Delivery): one test notice for the temporary test child "UT SOS Phone".
-- The insert fires the real geofence_events_notify_guardian trigger, which pushes it to the guardian
-- (unless that notice type is turned off in the guardian's notification settings).
insert into public.geofence_events (child_id, geofence_id, location_log_id, event_type, title, details, latitude, longitude, anomaly_score, occurred_at)
select p.id, null, null, 'prolonged_inactivity', 'Prolonged inactivity notice', 'The device of UT SOS Phone is online but SafeTrack has not received a recent usable location for 30 minutes. (Test notice for unit testing.)', 10.31646, 123.96523, null, now()
from public.persons p where p.full_name = 'UT SOS Phone'
returning event_type, title, to_char(occurred_at at time zone 'Asia/Manila', 'HH24:MI:SS') as recorded_at;
