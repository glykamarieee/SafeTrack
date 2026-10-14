-- SafeTrack: account deletion, notification preferences, live SOS updates,
-- and fixes for three broken database objects.
--
-- Run once in the Supabase SQL Editor. It is a single transaction: if any
-- preflight check fails, nothing is changed. Written against the live schema
-- the user exported on 2026-10-15 (db-evidence.txt).
--
-- 1. delete_my_account(): a guardian deletes their own account (soft delete;
--    every person row is referenced by RESTRICT foreign keys, so history keeps
--    a valid owner, as delete_my_child already does).
-- 2. guardian_notification_preferences + send_guardian_push() honouring it.
--    SOS and SOS re-alerts are always sent and cannot be turned off.
-- 3. sos_alerts added to the supabase_realtime publication (live SOS in the app).
-- 4. register_my_push_token() and send_guardian_push() use a token pattern
--    with single backslashes (see section 2).
-- 5. Fixes:
--    - anomaly_events "AI service can insert anomaly events" (INSERT for public
--      WITH CHECK true) is dropped: anyone with the publishable key could
--      insert fake anomalies. The AI service uses the service-role key, which
--      bypasses RLS, so it is unaffected.
--    - admin_update_device_status() wrote a nonexistent device_status column;
--      it now delegates to update_admin_smartwatch_device_status().
--    - acknowledge_my_qr_assistance_alert() referenced the nonexistent
--      qr_assistance_alerts table; it is dropped.

begin;

-- ---------------------------------------------------------------------------
-- Preflight
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.is_guardian_of(uuid)') is null
     or to_regprocedure('public.delete_my_child(uuid)') is null
     or to_regprocedure('public.person_has_role(uuid, text)') is null
     or to_regprocedure('public.is_current_safetrack_admin()') is null
     or to_regprocedure('public.update_admin_smartwatch_device_status(uuid, text)') is null
     or to_regprocedure('public.send_guardian_push(uuid, text, text, jsonb)') is null
     or to_regprocedure('public.register_my_push_token(text, text, text)') is null then
    raise exception 'Preflight failed: a required function is missing (is_guardian_of, delete_my_child, person_has_role, is_current_safetrack_admin, update_admin_smartwatch_device_status, send_guardian_push or register_my_push_token).';
  end if;

  if to_regclass('public.persons') is null
     or to_regclass('public.person_roles') is null
     or to_regclass('public.person_relationships') is null
     or to_regclass('public.geofences') is null
     or to_regclass('public.guardian_push_tokens') is null
     or to_regclass('public.sos_alerts') is null
     or to_regclass('public.anomaly_events') is null then
    raise exception 'Preflight failed: a required table is missing.';
  end if;

  if to_regclass('public.guardian_notification_preferences') is not null then
    raise exception 'Preflight failed: guardian_notification_preferences already exists (was this migration already applied?).';
  end if;

  if to_regprocedure('public.delete_my_account()') is not null then
    raise exception 'Preflight failed: delete_my_account() already exists (was this migration already applied?).';
  end if;

  if to_regclass('public.qr_assistance_alerts') is not null then
    raise exception 'Preflight failed: qr_assistance_alerts exists, so acknowledge_my_qr_assistance_alert must not be dropped. Review before applying.';
  end if;

  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'Preflight failed: the supabase_realtime publication is missing.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Account deletion (guardian, soft delete)
-- ---------------------------------------------------------------------------
create function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_child record;
  v_children_deleted integer := 0;
  v_children_kept integer := 0;
begin
  if v_me is null
     or not public.person_has_role(v_me, 'GUARDIAN')
     or not exists (select 1 from public.persons p where p.id = v_me and p.is_active) then
    raise exception 'Guardian authentication is required.' using errcode = '28000';
  end if;

  -- Children: removed (like delete_my_child) when this guardian is their only
  -- active guardian; otherwise only this guardian's link is ended.
  for v_child in
    select r.child_person_id as child_id
    from public.person_relationships r
    where r.guardian_person_id = v_me
      and r.is_active
  loop
    if exists (
      select 1
      from public.person_relationships other
      where other.child_person_id = v_child.child_id
        and other.guardian_person_id <> v_me
        and other.is_active
    ) then
      update public.person_relationships rel
      set is_active = false, is_primary = false, updated_at = now()
      where rel.child_person_id = v_child.child_id
        and rel.guardian_person_id = v_me;
      v_children_kept := v_children_kept + 1;
    else
      perform public.delete_my_child(v_child.child_id);
      v_children_deleted := v_children_deleted + 1;
    end if;
  end loop;

  -- Safe zones stop being evaluated; their history stays.
  update public.geofences g
  set is_enabled = false, updated_at = now()
  where g.guardian_id = v_me;

  -- No more pushes to this guardian's phones.
  delete from public.guardian_push_tokens t where t.guardian_id = v_me;
  delete from public.guardian_notification_preferences np where np.guardian_id = v_me;

  update public.person_roles pr
  set is_active = false
  where pr.person_id = v_me;

  -- Personal details removed; the row stays as the owner of past records.
  update public.persons p
  set
    is_active = false,
    full_name = 'Deleted account',
    email = null,
    phone_number = null,
    avatar_path = null,
    updated_at = now()
  where p.id = v_me;

  -- Sign the user out everywhere and block new sign-ins. Skipped (not failed)
  -- if this project does not allow changing the auth schema; the app also
  -- refuses inactive accounts.
  begin
    delete from auth.sessions s where s.user_id = v_me;
    update auth.users u set banned_until = 'infinity' where u.id = v_me;
  exception
    when insufficient_privilege or undefined_table or undefined_column then
      raise warning 'delete_my_account: could not revoke auth sessions (%).', sqlerrm;
  end;

  return jsonb_build_object(
    'ok', true,
    'children_deleted', v_children_deleted,
    'children_kept_with_other_guardian', v_children_kept
  );
end;
$$;

comment on function public.delete_my_account() is
  'Guardian deletes their own account: soft delete with personal details removed, children removed unless another guardian remains, devices released, push tokens deleted.';

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Notification preferences
-- ---------------------------------------------------------------------------
create table public.guardian_notification_preferences (
  guardian_id uuid primary key references public.persons(id) on delete cascade,
  safe_zone boolean not null default true,
  anomaly boolean not null default true,
  device boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.guardian_notification_preferences is
  'Which non-emergency push notifications a guardian receives. SOS and SOS re-alerts are always sent. No row means everything on.';

alter table public.guardian_notification_preferences enable row level security;

create policy "guardians can view own notification preferences"
  on public.guardian_notification_preferences for select to authenticated
  using (guardian_id = auth.uid());

create policy "guardians can add own notification preferences"
  on public.guardian_notification_preferences for insert to authenticated
  with check (guardian_id = auth.uid() and public.person_has_role(auth.uid(), 'GUARDIAN'));

create policy "guardians can update own notification preferences"
  on public.guardian_notification_preferences for update to authenticated
  using (guardian_id = auth.uid())
  with check (guardian_id = auth.uid());

revoke all on table public.guardian_notification_preferences from anon;
grant select, insert, update on table public.guardian_notification_preferences to authenticated;

-- Same signature and behaviour as before, plus the preference check.
create or replace function public.send_guardian_push(p_guardian_id uuid, p_title text, p_body text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_messages jsonb;
  v_type text := coalesce(p_data ->> 'type', '');
  v_prefs public.guardian_notification_preferences%rowtype;
begin
  -- SOS and re-alerts always go out. Other categories respect the guardian's
  -- preferences (no row means everything on).
  if v_type not in ('sos', 'sos_realert') then
    select * into v_prefs
    from public.guardian_notification_preferences np
    where np.guardian_id = p_guardian_id;

    if found then
      if (v_type in ('entry', 'exit') and not v_prefs.safe_zone)
         or (v_type = 'possible_anomaly' and not v_prefs.anomaly)
         or (v_type in ('watch_disconnected', 'prolonged_inactivity') and not v_prefs.device) then
        return;
      end if;
    end if;
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'to', t.push_token,
      'sound', 'default',
      'priority', 'high',
      'channelId', 'safetrack-alerts',
      'title', p_title,
      'body', p_body,
      'data', coalesce(p_data, '{}'::jsonb)
    )
  )
  into v_messages
  from public.guardian_push_tokens t
  where t.guardian_id = p_guardian_id
    and t.is_active
    and t.push_token ~ '^Expo(nent)?PushToken\[[^\]]+\]$';

  if v_messages is null then
    return;
  end if;

  -- Asynchronous: the request is sent after this transaction commits.
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := v_messages,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
  );
exception
  when others then
    -- A failed notification must never block saving the alert itself.
    raise warning 'send_guardian_push failed: %', sqlerrm;
end;
$function$;

-- Same signature and behaviour as before; the token pattern is written with
-- single backslashes so it matches real Expo tokens (ExponentPushToken[...]).
-- The exported definition showed doubled backslashes, which would reject
-- every token; if they were only an export artefact this changes nothing.
create or replace function public.register_my_push_token(p_push_token text, p_platform text, p_device_name text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_guardian_id uuid := auth.uid();
  v_token text := btrim(coalesce(p_push_token, ''));
  v_platform text := lower(btrim(coalesce(p_platform, '')));
begin
  if v_guardian_id is null
     or not public.person_has_role(v_guardian_id, 'GUARDIAN')
     or not exists (select 1 from public.persons p where p.id = v_guardian_id and p.is_active) then
    raise exception 'Guardian authentication is required.' using errcode = '28000';
  end if;

  if v_token !~ '^Expo(nent)?PushToken\[[^\]]+\]$' then
    raise exception 'A valid Expo push token is required.';
  end if;

  if v_platform not in ('android', 'ios', 'web') then
    raise exception 'Unsupported platform.';
  end if;

  -- A device token belongs to whoever registered it most recently.
  insert into public.guardian_push_tokens (
    guardian_id, push_token, platform, device_name, is_active, last_seen_at
  )
  values (
    v_guardian_id, v_token, v_platform, left(nullif(btrim(coalesce(p_device_name, '')), ''), 160), true, now()
  )
  on conflict (push_token) do update set
    guardian_id = excluded.guardian_id,
    platform = excluded.platform,
    device_name = excluded.device_name,
    is_active = true,
    last_seen_at = now(),
    updated_at = now();
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Live SOS updates in the app
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables pt
    where pt.pubname = 'supabase_realtime' and pt.schemaname = 'public' and pt.tablename = 'sos_alerts'
  ) then
    alter publication supabase_realtime add table public.sos_alerts;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Fixes
-- ---------------------------------------------------------------------------
drop policy if exists "AI service can insert anomaly events" on public.anomaly_events;

create or replace function public.admin_update_device_status(p_device_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- smartwatch_devices has no device_status column; status is is_active.
  -- Kept for old callers; the app uses update_admin_smartwatch_device_status.
  perform public.update_admin_smartwatch_device_status(p_device_id, p_status);
end;
$function$;

revoke all on function public.admin_update_device_status(uuid, text) from public, anon;
grant execute on function public.admin_update_device_status(uuid, text) to authenticated;

drop function if exists public.acknowledge_my_qr_assistance_alert(uuid);

commit;
