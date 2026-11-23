-- INT-035: an SOS cancelled on the real watch with "Sent by mistake" (23:42) is saved
-- as cancelled, is not re-alerted, and the guardian was told (push "Child cancelled the SOS").
-- The two earlier SOS alerts tonight were acknowledged by the guardian.
select to_char(s.triggered_at at time zone 'Asia/Manila', 'HH24:MI:SS')     as triggered,
       s.activation_method,
       s.status,
       s.realert_count,
       to_char(s.last_realert_at at time zone 'Asia/Manila', 'HH24:MI:SS')  as last_realert,
       to_char(s.acknowledged_at at time zone 'Asia/Manila', 'HH24:MI:SS')  as acknowledged,
       to_char(now() at time zone 'Asia/Manila', 'HH24:MI:SS')              as checked_at
from sos_alerts s
join smartwatch_devices w on w.child_id = s.child_id
where w.watch_id = 'ST-WATCH-F7MU6729'
  and s.triggered_at >= '2026-11-15 23:00:00+08'
order by s.triggered_at;
