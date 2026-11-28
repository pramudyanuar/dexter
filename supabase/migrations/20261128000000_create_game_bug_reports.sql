begin;

create table public.game_bug_reports (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  game text not null,
  game_title text not null,
  pathname text not null,
  description text not null check (char_length(description) between 1 and 2000),
  player_name text check (char_length(player_name) between 1 and 16),
  at bigint not null default (floor(extract(epoch from clock_timestamp()) * 1000)::bigint) check (at > 0),
  done boolean not null default false
);

create index game_bug_reports_at_id_idx on public.game_bug_reports (at desc, id desc);

alter table public.game_bug_reports enable row level security;
revoke all on table public.game_bug_reports from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.game_bug_reports to service_role;

commit;
