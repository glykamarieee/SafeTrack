-- CASE-257 (read-only): the guardian closed through Delete account on 11/25/2026 is turned off,
-- the personal details are removed, and new sign-ins are blocked.
select p.is_active, p.full_name, p.email, p.phone_number, p.avatar_path,
       (select u.banned_until is not null from auth.users u where u.id = p.id) as sign_in_blocked,
       (select count(*) from auth.sessions s where s.user_id = p.id) as open_sessions
from public.persons p where p.id = '27c09515-c7c6-4487-9dee-15c5a306df0d';
