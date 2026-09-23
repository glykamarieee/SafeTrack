begin;

alter table public.child_mobile_devices
enable row level security;


revoke all on public.child_mobile_devices
from anon, authenticated;


grant all on public.child_mobile_devices
to service_role;


commit;