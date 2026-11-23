-- INT-013: Locations from the registered smartwatch reach the AI review.
-- The scheduled safety scan stamps last_ai_review_at each time it sends the
-- child's newest location to the AI service (scheduled-safety-scan/index.ts).
select w.watch_id,
       count(l.id)                                                   as location_records,
       to_char(min(l.recorded_at) at time zone 'Asia/Manila', 'YYYY-MM-DD')        as first_record,
       round(extract(epoch from max(l.recorded_at) - min(l.recorded_at)) / 86400)  as days_of_records,
       to_char(max(l.recorded_at) at time zone 'Asia/Manila', 'YYYY-MM-DD HH24:MI') as latest_record,
       to_char(w.last_ai_review_at at time zone 'Asia/Manila', 'YYYY-MM-DD HH24:MI') as last_ai_review
from smartwatch_devices w
join location_logs l on l.child_id = w.child_id
where w.watch_id = 'ST-WATCH-F7MU6729'
group by w.watch_id, w.last_ai_review_at;
