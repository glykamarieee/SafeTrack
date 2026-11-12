-- Keep the AI service awake, 2026-11-12.
--
-- Render's free plan puts safetrack-ai to sleep after about 15 minutes with no
-- requests; the next AI review then waits 25-60 s for it to start. A request
-- to its status page every 10 minutes keeps it running. One service that
-- never sleeps uses about 730 of the free plan's 750 instance hours a month.
--
-- The request carries no key and reads no data ("/" only answers
-- {"system":"SafeTrack AI","status":"running"}).
--
-- Run once in the Supabase SQL editor. Safe to run again.
-- To stop it: select cron.unschedule('safetrack-ai-keep-awake');

begin;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron is not enabled; nothing was changed.';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'pg_net is not enabled; nothing was changed.';
  end if;
end;
$$;

select cron.schedule(
  'safetrack-ai-keep-awake',
  '*/10 * * * *',
  $job$select net.http_get(url := 'https://safetrack-ai-qigk.onrender.com/', timeout_milliseconds := 60000);$job$
);

commit;
