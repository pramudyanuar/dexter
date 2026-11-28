begin;

create table public.dexter_state (
  scope text not null,
  key text not null,
  revision uuid not null default gen_random_uuid(),
  value text not null,
  expires_at bigint,
  primary key (scope, key)
);

create index dexter_state_expiration on public.dexter_state (expires_at)
  where expires_at is not null;

alter table public.dexter_state enable row level security;
revoke all on public.dexter_state from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.dexter_state to service_role;

-- Serialize competing commits per key, including keys that do not exist yet.
-- Validate the entire read set before writing any rows.
create function public.dexter_commit_state(state_scope text, changes jsonb)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  item record;
  actual_revision uuid;
  now_ms bigint;
begin
  for item in
    select key from jsonb_to_recordset(changes) as x(key text)
    order by key collate "C"
  loop
    perform pg_advisory_xact_lock(hashtextextended(state_scope || ':' || item.key, 0));
  end loop;

  now_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  for item in
    select * from jsonb_to_recordset(changes) as x(key text, revision uuid)
  loop
    select s.revision into actual_revision
      from public.dexter_state s
      where s.scope = state_scope and s.key = item.key
        and (s.expires_at is null or s.expires_at > now_ms);
    if actual_revision is distinct from item.revision then
      return false;
    end if;
  end loop;

  for item in
    select * from jsonb_to_recordset(changes)
      as x(key text, write boolean, value text, expires_at bigint)
    where write
  loop
    if item.value is null then
      delete from public.dexter_state s where s.scope = state_scope and s.key = item.key;
    else
      insert into public.dexter_state (scope, key, value, expires_at)
        values (state_scope, item.key, item.value, item.expires_at)
      on conflict (scope, key) do update
        set value = excluded.value, expires_at = excluded.expires_at,
            revision = gen_random_uuid();
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.dexter_commit_state(text, jsonb) from public, anon, authenticated;
grant execute on function public.dexter_commit_state(text, jsonb) to service_role;

-- Supabase Cron removes expired state in the background.
do $$
begin
  if exists (select from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'dexter-prune-expired-state', '*/15 * * * *',
      'delete from public.dexter_state where expires_at <= floor(extract(epoch from now()) * 1000)::bigint'
    );
  end if;
end;
$$;

commit;
