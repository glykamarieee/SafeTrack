-- CASE-137: locations the watch could not send at once were kept and sent after the connection came back.
-- Read-only. fix_taken = when the watch took the location; reached_server = when SafeTrack received it.
select to_char(l.recorded_at at time zone 'Asia/Manila', 'MM-DD HH24:MI:SS') as fix_taken,
       to_char(l.created_at  at time zone 'Asia/Manila', 'MM-DD HH24:MI:SS') as reached_server,
       round(extract(epoch from l.created_at - l.recorded_at))::int as sent_later_s
from location_logs l
where l.source = 'smartwatch' and l.created_at - l.recorded_at between interval '60 seconds' and interval '2 hours'
order by l.created_at desc limit 8;
