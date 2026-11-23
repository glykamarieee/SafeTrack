-- CASE-120: while one problem continues (the real watch sends nothing), the scheduled safety scan
-- records the "Smartwatch connection unavailable" notice once, then a reminder at most every
-- 12 hours (REMINDER interval), not every scan. Shown: Oct 20 9:48 AM to Oct 21 9:50 AM, when the real watch was off;
-- the scan ran every minute, yet only one notice and then 12-hour reminders were recorded.
with ev as (
  select e.occurred_at,
         lag(e.occurred_at) over (order by e.occurred_at) as previous_notice
  from geofence_events e
  join smartwatch_devices w on w.child_id = e.child_id
  where w.watch_id = 'ST-WATCH-F7MU6729' and e.event_type = 'watch_disconnected'
)
select to_char(ev.previous_notice at time zone 'Asia/Manila', 'MM-DD HH24:MI')  as notice,
       to_char(ev.occurred_at     at time zone 'Asia/Manila', 'MM-DD HH24:MI')  as reminder,
       round(extract(epoch from ev.occurred_at - ev.previous_notice) / 3600, 1) as hours_between
from ev
where ev.previous_notice is not null
  and ev.occurred_at between '2026-10-20 12:00+08' and '2026-10-21 10:00+08'
order by ev.occurred_at
limit 6;
