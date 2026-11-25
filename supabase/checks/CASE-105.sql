-- CASE-105: re-alerts stop when the count reaches the set maximum (SOS_MAX_REALERTS = 10). Read-only.
select to_char(a.created_at at time zone 'Asia/Manila','MM-DD HH24:MI') as sos_sent, p.full_name as child,
       a.realert_count as re_alerts_sent, a.status
from sos_alerts a join persons p on p.id = a.child_id
order by a.realert_count desc, a.created_at desc limit 5;
