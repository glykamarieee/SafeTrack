-- read-only: both 11/25 fixes are in the live functions
select position('Same point sent again' in pg_get_functiondef('public.record_watch_location(text, text, double precision, double precision, double precision, timestamp with time zone, integer, text, text)'::regprocedure)) > 0 as watch_point_dedupe,
       position('''child_id'', new.child_id' in (select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'notify_guardian_of_safety_event')) > 0 as zone_push_child_id;
