-- SOS fast tracking (11/16/2026, after the change): the real watch sent an SOS at 10:21:08 and
-- cancelled it as sent by mistake at 10:22:07. During the SOS it saved a record about every 5 s;
-- after the cancel it went back to the normal rate.
select case when l.recorded_at < '2026-11-16 10:22:08+08' then 'during SOS' else 'after cancel' end as period,
       count(*)                                                                                    as records,
       round(extract(epoch from max(l.recorded_at) - min(l.recorded_at)) / greatest(count(*) - 1, 1)) as avg_seconds_between
from location_logs l
join smartwatch_devices w on w.child_id = l.child_id
where w.watch_id = 'ST-WATCH-F7MU6729'
  and l.recorded_at between '2026-11-16 10:21:08+08' and '2026-11-16 10:25:08+08'
group by 1 order by 1 desc;
