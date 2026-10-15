-- SafeTrack: make admin report export (PDF / Excel) save its report record.
--
-- Run once in the Supabase SQL Editor. It is a single transaction: if any
-- preflight check fails, nothing is changed.
--
-- Problem: generate-report inserts activity_reports rows with
--   export_format  'PDF' | 'Excel'
--   report_type    'child_activity' | 'system_activity'
--   report_status  'generating' | 'completed' | 'failed'
-- but the live table has older check constraints (not in this repo) that
-- reject these values, e.g. "violates check constraint
-- activity_reports_export_format_check", so no file is ever produced.
--
-- Fix: replace every CHECK constraint on those three columns with one that
-- accepts the values the function writes plus common older spellings
-- (case-insensitive), added NOT VALID so existing rows are never rejected.
-- Also makes sure the private "activity-reports" storage bucket exists.

begin;

-- ---------------------------------------------------------------------------
-- Preflight
-- ---------------------------------------------------------------------------
do $$
declare
  missing text;
begin
  if to_regclass('public.activity_reports') is null then
    raise exception 'Preflight failed: public.activity_reports does not exist.';
  end if;

  select string_agg(required.column_name, ', ')
    into missing
    from (values ('export_format'), ('report_type'), ('report_status'),
                 ('file_path'), ('generated_at'), ('record_count'), ('filters'))
         as required(column_name)
   where not exists (
     select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'activity_reports'
        and c.column_name = required.column_name);

  if missing is not null then
    raise exception 'Preflight failed: activity_reports is missing column(s): %', missing;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Replace the CHECK constraints on export_format, report_type, report_status
-- ---------------------------------------------------------------------------
do $$
declare
  con record;
begin
  for con in
    select c.conname
      from pg_constraint c
     where c.conrelid = 'public.activity_reports'::regclass
       and c.contype = 'c'
       and exists (
         select 1
           from unnest(c.conkey) as k(attnum)
           join pg_attribute a
             on a.attrelid = c.conrelid and a.attnum = k.attnum
          where a.attname in ('export_format', 'report_type', 'report_status'))
  loop
    raise notice 'Dropping old constraint %', con.conname;
    execute format('alter table public.activity_reports drop constraint %I', con.conname);
  end loop;
end;
$$;

alter table public.activity_reports
  add constraint activity_reports_export_format_check
  check (lower(export_format) in ('pdf', 'excel', 'xlsx')) not valid;

alter table public.activity_reports
  add constraint activity_reports_report_type_check
  check (lower(report_type) in (
    'child_activity', 'system_activity', 'activity', 'summary',
    'sos', 'location', 'safety', 'safe_zone', 'custom')) not valid;

alter table public.activity_reports
  add constraint activity_reports_report_status_check
  check (lower(report_status) in (
    'pending', 'generating', 'processing', 'completed', 'failed')) not valid;

-- ---------------------------------------------------------------------------
-- Private bucket for the generated files (signed URLs only)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('activity-reports', 'activity-reports', false)
on conflict (id) do nothing;

commit;

-- Check afterwards:
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--  where conrelid = 'public.activity_reports'::regclass and contype = 'c';
