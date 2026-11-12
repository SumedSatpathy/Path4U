create table public.openpath_library (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('draft', 'conversation')),
  id uuid not null,
  value jsonb not null check (jsonb_typeof(value) = 'object' and octet_length(value::text) <= 85000),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);
create index openpath_library_recent on public.openpath_library (user_id, kind, updated_at desc);
alter table public.openpath_library enable row level security;
revoke all on public.openpath_library from anon, authenticated;
grant select, insert, update, delete on public.openpath_library to authenticated;
create policy openpath_library_own on public.openpath_library for all to authenticated
  using ((select auth.uid()) = user_id and (select openpath_private.is_ready()))
  with check ((select auth.uid()) = user_id and (select openpath_private.is_ready()));

create function openpath_private.limit_library_items() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text || ':' || new.kind, 0));
  if not exists (select 1 from public.openpath_library where user_id = new.user_id and kind = new.kind and id = new.id)
    and (select count(*) from public.openpath_library where user_id = new.user_id and kind = new.kind) >= 30 then
    raise exception 'Library item limit reached';
  end if;
  return new;
end;
$$;
revoke all on function openpath_private.limit_library_items() from public;
create trigger openpath_library_limit before insert on public.openpath_library
  for each row execute function openpath_private.limit_library_items();

create table public.openpath_assistant_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  units smallint not null check (units between 1 and 18),
  primary key (user_id, window_start)
);
alter table public.openpath_assistant_usage enable row level security;
revoke all on public.openpath_assistant_usage from anon, authenticated;
grant select, insert, update, delete on public.openpath_assistant_usage to service_role;

create function public.openpath_claim_assistant_usage(p_user uuid, p_units integer) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  if p_units not in (1, 3) then return false; end if;
  delete from public.openpath_assistant_usage where user_id = p_user and window_start < pg_catalog.now() - interval '2 days';
  insert into public.openpath_assistant_usage as usage (user_id, window_start, units)
    values (p_user, pg_catalog.date_trunc('hour', pg_catalog.now(), 'UTC'), p_units)
  on conflict (user_id, window_start) do update set units = usage.units + excluded.units
    where usage.units + excluded.units <= 18;
  return found;
end;
$$;
revoke all on function public.openpath_claim_assistant_usage(uuid, integer) from public, anon, authenticated;
grant execute on function public.openpath_claim_assistant_usage(uuid, integer) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('path4u-assistant', 'path4u-assistant', false, 2500000, array[
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]) on conflict (id) do nothing;

create policy path4u_attachment_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'path4u-assistant' and (storage.foldername(name))[1] = (select auth.uid())::text and (select openpath_private.is_ready()));
create policy path4u_attachment_read on storage.objects for select to authenticated
  using (bucket_id = 'path4u-assistant' and (storage.foldername(name))[1] = (select auth.uid())::text and (select openpath_private.is_ready()));
create policy path4u_attachment_delete on storage.objects for delete to authenticated
  using (bucket_id = 'path4u-assistant' and (storage.foldername(name))[1] = (select auth.uid())::text and (select openpath_private.is_ready()));
