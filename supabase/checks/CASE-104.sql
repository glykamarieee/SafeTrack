-- CASE-104: after the guardian acknowledged the SOS, no further re-alert was sent. Read-only.
select to_char(a.created_at at time zone 'Asia/Manila','HH24:MI:SS') as sos_sent,
       to_char(a.acknowledged_at at time zone 'Asia/Manila','HH24:MI:SS') as acknowledged,
       a.realert_count as re_alerts_sent, a.status,
       to_char(now() at time zone 'Asia/Manila','HH24:MI:SS') as checked_at
from sos_alerts a join persons p on p.id = a.child_id
where p.full_name = 'UT Child Two' order by a.created_at desc limit 1;
