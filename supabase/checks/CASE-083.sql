-- CASE-083: the real watch sent an SOS at 09:01 with its location turned off. The SOS is still
-- stored, with the last location the watch had (shown with that location's own time).
select to_char(s.triggered_at at time zone 'Asia/Manila', 'HH24:MI:SS')  as sos_triggered,
       s.status,
       s.latitude, s.longitude,
       to_char(l.recorded_at at time zone 'Asia/Manila', 'HH24:MI:SS')  as location_recorded
from sos_alerts s
join smartwatch_devices w on w.child_id = s.child_id
left join location_logs l on l.id = s.location_log_id
where w.watch_id = 'ST-WATCH-F7MU6729'
  and s.triggered_at between '2026-11-16 09:01:00+08' and '2026-11-16 09:02:30+08';
