-- Additive repair: preserve every legacy table, account, policy and auth.users trigger.
-- Age is self-declared and written by the server to trusted app_metadata; no DOB is stored.
create schema if not exists openpath_private;
revoke all on schema openpath_private from public, anon, authenticated;
grant usage on schema openpath_private to authenticated;

create table public.openpath_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 preferences jsonb not null check(jsonb_typeof(preferences)='object' and octet_length(preferences::text)<=12000),
 completed_at timestamptz not null default now()
);
create table public.openpath_workspace (
 user_id uuid primary key references auth.users(id) on delete cascade,
 state jsonb not null check(jsonb_typeof(state)='object' and octet_length(state::text)<=90000),
 revision bigint not null default 0 check(revision>=0)
);
create table public.openpath_library (
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('draft','conversation')),
 id uuid not null,
 value jsonb not null check(jsonb_typeof(value)='object' and octet_length(value::text)<=85000),
 updated_at timestamptz not null default now(),
 primary key(user_id,kind,id)
);
create index openpath_library_recent on public.openpath_library(user_id,kind,updated_at desc);

-- Internal lookup requires definer privileges to inspect Auth confirmation and trusted metadata.
-- It accepts no caller-supplied identity and is callable only by authenticated users.
create function openpath_private.is_eligible() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=(select auth.uid())
 and u.email_confirmed_at is not null and u.raw_app_meta_data->>'age_requirement_met'='true');
$$;
create function openpath_private.is_ready() returns boolean
language sql stable security definer set search_path='' as $$
 select (select openpath_private.is_eligible()) and exists(select 1 from public.openpath_profiles where user_id=(select auth.uid()));
$$;
revoke all on function openpath_private.is_eligible(),openpath_private.is_ready() from public,anon,authenticated;
grant execute on function openpath_private.is_eligible(),openpath_private.is_ready() to authenticated;

alter table public.openpath_profiles enable row level security;
alter table public.openpath_workspace enable row level security;
alter table public.openpath_library enable row level security;
revoke all on public.openpath_profiles,public.openpath_workspace,public.openpath_library from public,anon,authenticated;
grant select,insert,update on public.openpath_profiles,public.openpath_workspace to authenticated;
grant select,insert,update,delete on public.openpath_library to authenticated;
grant select,insert,update,delete on public.openpath_profiles,public.openpath_workspace,public.openpath_library to service_role;
create policy openpath_profiles_own on public.openpath_profiles for all to authenticated
 using(user_id=(select auth.uid()) and (select openpath_private.is_eligible()))
 with check(user_id=(select auth.uid()) and (select openpath_private.is_eligible()));
create policy openpath_workspace_own on public.openpath_workspace for all to authenticated
 using(user_id=(select auth.uid()) and (select openpath_private.is_ready()))
 with check(user_id=(select auth.uid()) and (select openpath_private.is_ready()));
create policy openpath_library_own on public.openpath_library for all to authenticated
 using(user_id=(select auth.uid()) and (select openpath_private.is_ready()))
 with check(user_id=(select auth.uid()) and (select openpath_private.is_ready()));

create function openpath_private.limit_library_items() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text||':'||new.kind,0));
 if not exists(select 1 from public.openpath_library where user_id=new.user_id and kind=new.kind and id=new.id)
 and (select count(*) from public.openpath_library where user_id=new.user_id and kind=new.kind)>=30 then
 raise exception 'Library item limit reached'; end if;
 return new;
end; $$;
revoke all on function openpath_private.limit_library_items() from public,anon,authenticated;
create trigger openpath_library_limit before insert on public.openpath_library for each row execute function openpath_private.limit_library_items();

create table public.openpath_opportunities (
 id text primary key, listing jsonb not null check(jsonb_typeof(listing)='object'),
 published_at timestamptz not null default now(), deadline_at timestamptz, verified_at timestamptz,
 active boolean not null default true
);
alter table public.openpath_opportunities enable row level security;
revoke all on public.openpath_opportunities from public,anon,authenticated;
grant select on public.openpath_opportunities to anon,authenticated;
grant select,insert,update,delete on public.openpath_opportunities to service_role;
create policy openpath_opportunities_public on public.openpath_opportunities for select to anon,authenticated using(active);

create table public.path4u_feed_cache (
 provider text primary key, payload jsonb not null, checked_at timestamptz not null default now(),
 retry_after timestamptz not null default now(), last_error boolean not null default false
);
create table public.path4u_ai_counters (
 key text primary key, used integer not null check(used>=0), expires_at timestamptz not null
);
create table public.path4u_ai_requests (
 subject text not null, request_id uuid not null, fingerprint text not null,
 result jsonb, expires_at timestamptz not null default now()+interval '1 day',
 primary key(subject,request_id)
);
create table public.path4u_public_ai_cache (
 key text primary key, value jsonb not null, expires_at timestamptz not null
);
alter table public.path4u_feed_cache enable row level security;
alter table public.path4u_ai_counters enable row level security;
alter table public.path4u_ai_requests enable row level security;
alter table public.path4u_public_ai_cache enable row level security;
revoke all on public.path4u_feed_cache,public.path4u_ai_counters,public.path4u_ai_requests,public.path4u_public_ai_cache from public,anon,authenticated;
grant select,insert,update,delete on public.path4u_feed_cache,public.path4u_ai_counters,public.path4u_ai_requests,public.path4u_public_ai_cache to service_role;

-- Atomic shared limits across all serverless instances. UTC daily windows, explicitly
-- app safety caps, not a representation of the Google project's unknown actual quota.
create function public.path4u_reserve_ai(p_subject text,p_request uuid,p_fingerprint text,p_kind text,p_guest boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d text:=to_char(now() at time zone 'UTC','YYYY-MM-DD');
 m text:=to_char(now() at time zone 'UTC','YYYY-MM-DD-HH24-MI');
 keys text[]; caps integer[]; old public.path4u_ai_requests; n integer; balance integer;
begin
 if length(p_subject)>100 or length(p_fingerprint)<>64 or p_kind not in ('chat','roadmap') then return jsonb_build_object('state','invalid'); end if;
 perform pg_catalog.pg_advisory_xact_lock(641412026);
 delete from public.path4u_ai_counters where expires_at<now();
 delete from public.path4u_ai_requests where expires_at<now();
 select * into old from public.path4u_ai_requests where subject=p_subject and request_id=p_request;
 if found then
  if old.fingerprint<>p_fingerprint then return jsonb_build_object('state','conflict');end if;
  return jsonb_build_object('state','duplicate','result',old.result);
 end if;
 keys:=array['global:'||d,'subject:'||d||':'||p_subject,'minute:'||m];
 caps:=array[80,case when p_guest then 4 else 12 end,4];
 if p_kind='roadmap' then keys:=array_append(keys,'roadmap:'||d||':'||p_subject);caps:=array_append(caps,case when p_guest then 1 else 2 end);end if;
 for n in 1..array_length(keys,1) loop
  if coalesce((select used from public.path4u_ai_counters where key=keys[n]),0)>=caps[n] then return jsonb_build_object('state','limited');end if;
 end loop;
 for n in 1..array_length(keys,1) loop
  insert into public.path4u_ai_counters(key,used,expires_at) values(keys[n],1,now()+interval '2 days')
  on conflict(key) do update set used=public.path4u_ai_counters.used+1;
 end loop;
 insert into public.path4u_ai_requests(subject,request_id,fingerprint) values(p_subject,p_request,p_fingerprint);
 select caps[2]-used into balance from public.path4u_ai_counters where key=keys[2];
 return jsonb_build_object('state','reserved','remaining',balance);
end; $$;
revoke all on function public.path4u_reserve_ai(text,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.path4u_reserve_ai(text,uuid,text,text,boolean) to service_role;
notify pgrst,'reload schema';
