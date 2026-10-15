-- SafeTrack: deleted accounts made sign-in fail with HTTP 500.
--
-- Run once in the Supabase SQL Editor, after 20261015 and 20261016. Single
-- transaction: if a preflight check fails, nothing changes.
--
-- Problem: delete_my_account() set auth.users.banned_until = 'infinity'.
-- Supabase Auth (GoTrue) cannot parse 'infinity' as a time, so signing in
-- with a deleted account returned 500 instead of "user is banned".
--
-- Fix:
-- 1. delete_my_account() now bans until a far-future date (2999-12-31).
-- 2. Accounts already deleted with 'infinity' are repaired the same way.

begin;

do $$
begin
  if to_regprocedure('public.delete_my_account()') is null then
    raise exception 'Preflight failed: delete_my_account() is missing (apply 20261015 first).';
  end if;
end;
$$;

create or replace function public.delete_my_account()
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
    update auth.users u set banned_until = '2999-12-31 00:00:00+00' where u.id = v_me;
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

-- Repair accounts deleted before this fix.
update auth.users u
set banned_until = '2999-12-31 00:00:00+00'
where u.banned_until = 'infinity';

commit;
