-- CASE-137/138: the watch (test child "UT Child Three") lost Wi-Fi and data, moved, then reconnected.
-- Read-only. Locations around that time: recorded_at = when the watch took the fix, created_at = when it reached the server.
select to_char(l.recorded_at at time zone 'Asia/Manila', 'HH24:MI:SS') as fix_taken,
       to_char(l.created_at at time zone 'Asia/Manila', 'HH24:MI:SS') as reached_server,
       round(extract(epoch from l.created_at - l.recorded_at)::numeric) as delay_s,
       round(l.latitude::numeric, 5) as lat, round(l.longitude::numeric, 5) as lng
from location_logs l join persons p on p.id = l.child_id
where p.full_name = 'UT Child Three' and l.created_at > now() - interval '6 minutes'
order by l.recorded_at;
