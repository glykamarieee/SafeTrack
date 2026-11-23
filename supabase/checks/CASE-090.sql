-- CASE-090: an SOS triggered on the watch while offline (05:25:51) is stored once after the
-- watch reconnects, with its original trigger time; no duplicate alert is created.
select to_char(s.triggered_at at time zone 'Asia/Manila', 'HH24:MI:SS') as triggered_on_watch,
       to_char(s.created_at   at time zone 'Asia/Manila', 'HH24:MI:SS') as stored_on_server,
       s.activation_method,
       count(*) over ()                                                  as alerts_for_this_trigger
from sos_alerts s
join persons p on p.id = s.child_id
where p.full_name = 'UT Child Three'
  and s.triggered_at between '2026-11-16 05:25:00+08' and '2026-11-16 05:27:00+08';
