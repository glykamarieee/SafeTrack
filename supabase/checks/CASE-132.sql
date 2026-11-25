-- CASE-132 (read-only): UT Child One's watch records sent after the 11/25/2026 fix, grouped by recorded time.
-- Each point was sent twice by the test (restart / reconnect); each must be saved once.
select l.recorded_at, count(*) as saved_records
from public.location_logs l
join public.smartwatch_devices w on w.child_id = l.child_id
where w.watch_id = 'ST-WATCH-NFEGJ9K6' and l.recorded_at > '2026-11-25 00:09:30+00'
group by l.recorded_at order by l.recorded_at desc limit 6;
