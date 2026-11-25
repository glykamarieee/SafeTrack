-- CASE-130: during an SOS the watch saves its location about every 5 seconds until the SOS ends.
-- Read-only. The newest SOS of the test child "UT Child Three" and the locations its watch saved meanwhile.
with s as (
  select a.id, a.child_id, a.created_at, coalesce(a.acknowledged_at, a.updated_at) as ended_at, a.status
  from sos_alerts a join persons p on p.id = a.child_id
  where p.full_name = 'UT Child Three' order by a.created_at desc limit 1
)
select to_char(l.recorded_at at time zone 'Asia/Manila', 'HH24:MI:SS') as saved_at,
       round(extract(epoch from l.recorded_at - lag(l.recorded_at) over (order by l.recorded_at))::numeric, 1) as seconds_after_previous,
       l.source, s.status as sos_status
from s join location_logs l on l.child_id = s.child_id
 and l.recorded_at between s.created_at - interval '20 seconds' and s.ended_at
order by l.recorded_at;
