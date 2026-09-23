-- SafeTrack Child Mobile Device Integration
-- Supports:
-- Mobile only
-- Smartwatch + Mobile


begin;


create table if not exists public.child_mobile_devices (

    id uuid primary key default gen_random_uuid(),


    child_id uuid not null
        references public.child_profiles(id)
        on delete cascade,


    device_token_hash text,


    pairing_code_hash text,


    pairing_code_expires_at timestamptz,


    pairing_code_created_at timestamptz,


    platform text,


    device_model text,


    is_active boolean default true,


    paired_at timestamptz,


    last_seen_at timestamptz,


    created_at timestamptz default now(),


    updated_at timestamptz default now()

);



create index if not exists idx_child_mobile_devices_child
on public.child_mobile_devices(child_id);



create index if not exists idx_child_mobile_devices_active
on public.child_mobile_devices(child_id, is_active);



commit;