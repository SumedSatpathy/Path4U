alter table public.openpath_signup_tickets
  add column age_policy_version text not null default 'my-18-v1'
  check (age_policy_version in ('my-18-v1', 'my-15-v2'));

create or replace function openpath_private.require_signup_attestation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  ticket text := new.raw_user_meta_data ->> 'openpath_age_ticket';
  policy_version text;
begin
  if new.raw_app_meta_data ->> 'provider' is distinct from 'email' or new.email is null
     or ticket is null or new.email_confirmed_at is not null then
    raise exception 'Path4U requires the verified email signup flow';
  end if;

  delete from public.openpath_signup_tickets
  where token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(ticket, 'UTF8')), 'hex')
    and email_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.lower(pg_catalog.btrim(new.email)), 'UTF8')), 'hex')
    and expires_at > pg_catalog.now()
  returning age_policy_version into policy_version;
  if not found then
    raise exception 'Path4U requires a valid age attestation';
  end if;

  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'openpath_age_ticket';
  new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) ||
    pg_catalog.jsonb_build_object('age_requirement_met', true, 'age_attestation_at', pg_catalog.now(), 'age_policy_version', policy_version);
  return new;
end;
$$;

create table public.path4u_demo_sessions (
  session_id uuid primary key,
  bucket text not null,
  credits smallint not null default 20 check (credits between 0 and 20),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index path4u_demo_sessions_bucket_expiry on public.path4u_demo_sessions (bucket, expires_at);
create index path4u_demo_sessions_expiry on public.path4u_demo_sessions (expires_at);

create table public.path4u_demo_transactions (
  session_id uuid not null references public.path4u_demo_sessions on delete cascade,
  request_id uuid not null,
  fingerprint text not null,
  cost smallint not null check (cost between 1 and 3),
  primary key (session_id, request_id)
);
alter table public.path4u_demo_sessions enable row level security;
alter table public.path4u_demo_transactions enable row level security;
revoke all on public.path4u_demo_sessions, public.path4u_demo_transactions from public, anon, authenticated;
grant select, insert, update, delete on public.path4u_demo_sessions, public.path4u_demo_transactions to service_role;

create function public.path4u_demo_session(p_session uuid, p_bucket text)
returns integer language plpgsql security invoker set search_path = '' as $$
declare balance integer;
begin
  select credits into balance from public.path4u_demo_sessions where session_id = p_session and expires_at > now();
  if found then return balance; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_bucket, 0));
  select credits into balance from public.path4u_demo_sessions where session_id = p_session and expires_at > now();
  if found then return balance; end if;
  if (select count(*) from public.path4u_demo_sessions where bucket = p_bucket and expires_at > now()) >= 4 then
    return -1;
  end if;
  delete from public.path4u_demo_sessions where session_id = p_session and expires_at <= now();
  delete from public.path4u_demo_sessions where session_id in (
    select session_id from public.path4u_demo_sessions where expires_at <= now()
    order by expires_at limit 20 for update skip locked
  );
  insert into public.path4u_demo_sessions(session_id, bucket) values (p_session, p_bucket) returning credits into balance;
  return balance;
end;
$$;

create function public.path4u_demo_charge(p_session uuid, p_request uuid, p_fingerprint text, p_cost integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  balance integer;
  existing text;
begin
  select credits into balance from public.path4u_demo_sessions where session_id = p_session and expires_at > now() for update;
  if not found then return -3; end if;
  select fingerprint into existing from public.path4u_demo_transactions where session_id = p_session and request_id = p_request;
  if found then
    if existing = p_fingerprint then return balance; end if;
    return -2;
  end if;
  if p_cost not between 1 and 3 or balance < p_cost then return -1; end if;
  insert into public.path4u_demo_transactions(session_id, request_id, fingerprint, cost) values (p_session, p_request, p_fingerprint, p_cost);
  update public.path4u_demo_sessions set credits = credits - p_cost where session_id = p_session returning credits into balance;
  return balance;
end;
$$;

revoke all on function public.path4u_demo_session(uuid, text), public.path4u_demo_charge(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.path4u_demo_session(uuid, text), public.path4u_demo_charge(uuid, uuid, text, integer) to service_role;
