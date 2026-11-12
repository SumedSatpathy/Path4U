-- Apply to the OpenPath project's Auth database after reviewing any existing auth.users triggers.
create schema if not exists openpath_private;
revoke all on schema openpath_private from public, anon, authenticated;
grant usage on schema openpath_private to authenticated;

create table if not exists public.openpath_signup_tickets (
  token_hash text primary key,
  email_hash text not null,
  expires_at timestamptz not null default now() + interval '5 minutes'
);
alter table public.openpath_signup_tickets enable row level security;
revoke all on public.openpath_signup_tickets from public, anon, authenticated;
grant insert, delete, select on public.openpath_signup_tickets to service_role;

create or replace function openpath_private.require_signup_attestation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  ticket text := new.raw_user_meta_data ->> 'openpath_age_ticket';
begin
  if new.raw_app_meta_data ->> 'provider' is distinct from 'email' or new.email is null
     or ticket is null or new.email_confirmed_at is not null then
    raise exception 'OpenPath requires the verified email signup flow';
  end if;

  delete from public.openpath_signup_tickets
  where token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(ticket, 'UTF8')), 'hex')
    and email_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.lower(pg_catalog.btrim(new.email)), 'UTF8')), 'hex')
    and expires_at > pg_catalog.now();
  if not found then
    raise exception 'OpenPath requires a valid age attestation';
  end if;

  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'openpath_age_ticket';
  new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) ||
    pg_catalog.jsonb_build_object('age_requirement_met', true, 'age_attestation_at', pg_catalog.now(), 'age_policy_version', 'my-18-v1');
  return new;
end;
$$;
revoke all on function openpath_private.require_signup_attestation() from public, anon, authenticated;
create trigger openpath_require_signup_attestation before insert on auth.users
  for each row execute function openpath_private.require_signup_attestation();

create table if not exists public.openpath_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null check (
    jsonb_typeof(preferences) = 'object' and octet_length(preferences::text) <= 12000
    and coalesce(length(btrim(preferences ->> 'organization')), 0) between 1 and 120
    and coalesce(length(btrim(preferences ->> 'field')), 0) between 1 and 120
    and coalesce(preferences ->> 'stage', '') in ('Student', 'Graduate', 'Professional')
    and case when jsonb_typeof(preferences -> 'interests') = 'array' then jsonb_array_length(preferences -> 'interests') between 1 and 24 else false end
    and case when jsonb_typeof(preferences -> 'goals') = 'array' then jsonb_array_length(preferences -> 'goals') between 1 and 24 else false end
    and coalesce(jsonb_typeof(preferences -> 'skills'), '') = 'array'
  ),
  completed_at timestamptz not null default now()
);
alter table public.openpath_profiles enable row level security;

create or replace function openpath_private.is_eligible() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u where u.id = (select auth.uid()) and u.email_confirmed_at is not null
      and u.raw_app_meta_data ->> 'age_requirement_met' = 'true'
  );
$$;
create or replace function openpath_private.is_ready() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select openpath_private.is_eligible()) and exists (
    select 1 from public.openpath_profiles p where p.user_id = (select auth.uid())
  );
$$;
revoke all on function openpath_private.is_eligible(), openpath_private.is_ready() from public, anon;
grant execute on function openpath_private.is_eligible(), openpath_private.is_ready() to authenticated;
revoke all on public.openpath_profiles from public, anon, authenticated;
grant select, insert, update on public.openpath_profiles to authenticated;
create policy openpath_profile_read on public.openpath_profiles for select to authenticated
  using ((select auth.uid()) = user_id and (select openpath_private.is_eligible()));
create policy openpath_profile_insert on public.openpath_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id and (select openpath_private.is_eligible()));
create policy openpath_profile_update on public.openpath_profiles for update to authenticated
  using ((select auth.uid()) = user_id and (select openpath_private.is_eligible()))
  with check ((select auth.uid()) = user_id and (select openpath_private.is_eligible()));

create table if not exists public.openpath_opportunities (
  id text primary key,
  listing jsonb not null check (jsonb_typeof(listing) = 'object'),
  published_at timestamptz not null default now(),
  deadline_at timestamptz,
  verified_at timestamptz,
  active boolean not null default true
);
alter table public.openpath_opportunities enable row level security;
revoke all on public.openpath_opportunities from public, anon, authenticated;
grant select on public.openpath_opportunities to authenticated;
grant select, insert, update, delete on public.openpath_opportunities to service_role;
create policy openpath_opportunity_read on public.openpath_opportunities for select to authenticated
  using (active and (select openpath_private.is_ready()));

create table if not exists public.openpath_workspace (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object' and octet_length(state::text) <= 90000),
  revision bigint not null default 0 check (revision >= 0)
);
alter table public.openpath_workspace enable row level security;
revoke all on public.openpath_workspace from public, anon, authenticated;
grant select, insert, update on public.openpath_workspace to authenticated;
create policy openpath_workspace_read on public.openpath_workspace for select to authenticated
  using ((select auth.uid()) = user_id and (select openpath_private.is_ready()));
create policy openpath_workspace_insert on public.openpath_workspace for insert to authenticated
  with check ((select auth.uid()) = user_id and (select openpath_private.is_ready()));
create policy openpath_workspace_update on public.openpath_workspace for update to authenticated
  using ((select auth.uid()) = user_id and (select openpath_private.is_ready()))
  with check ((select auth.uid()) = user_id and (select openpath_private.is_ready()));
