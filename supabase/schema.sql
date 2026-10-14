-- Wardenfall backend schema for Supabase.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: it only creates what is missing and replaces views/policies.

-- ---------- tables ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null unique check (name ~ '^[A-Za-z0-9_]{3,16}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.runs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mode text not null check (mode in ('daily', 'endless')),
  daily_no int,
  seed bigint not null,
  floor int not null check (floor between 1 and 500),
  kills int not null check (kills between 0 and 20000),
  turns int not null check (turns between 0 and 200000),
  relics text not null default '' check (length(relics) <= 200),
  killed_by text not null default '' check (length(killed_by) <= 60),
  -- Full input log. The game is deterministic, so this lets runs be replayed and verified.
  log text not null default '' check (length(log) <= 200000),
  created_at timestamptz not null default now(),
  check ((mode = 'daily') = (daily_no is not null))
);

-- Progress that carries between runs (Souls, unlocks, achievements), synced across devices.
alter table public.profiles add column if not exists meta jsonb not null default '{}'::jsonb;
do $$ begin
  alter table public.profiles add constraint profiles_meta_size check (pg_column_size(meta) < 32000);
exception when duplicate_object then null; end $$;

-- One official daily attempt per player.
create unique index if not exists runs_one_daily_per_user on public.runs (user_id, daily_no) where mode = 'daily';
create index if not exists runs_daily_rank on public.runs (daily_no, floor desc, kills desc, turns) where mode = 'daily';
create index if not exists runs_endless_rank on public.runs (user_id, floor desc, kills desc, turns) where mode = 'endless';

-- Daily #1 is 2026-10-14 (UTC). Must match src/daily.ts.
create or replace function public.current_daily_no() returns int
language sql stable as $$
  select ((now() at time zone 'utc')::date - date '2026-10-14') + 1
$$;

-- ---------- row level security ----------

alter table public.profiles enable row level security;
alter table public.runs enable row level security;

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (true);

drop policy if exists "create own profile" on public.profiles;
create policy "create own profile" on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "rename own profile" on public.profiles;
create policy "rename own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "runs are public" on public.runs;
create policy "runs are public" on public.runs for select using (true);

-- Players can only submit their own runs, and dailies only for today's crypt
-- (one day of slack either side for clock skew and runs that cross midnight).
drop policy if exists "submit own runs" on public.runs;
create policy "submit own runs" on public.runs for insert to authenticated
  with check (
    user_id = auth.uid()
    and (mode = 'endless' or daily_no between public.current_daily_no() - 1 and public.current_daily_no() + 1)
  );

-- ---------- leaderboards ----------

create or replace view public.leaderboard_daily with (security_invoker = on) as
select
  r.daily_no,
  r.user_id,
  p.name,
  r.floor,
  r.kills,
  r.turns,
  r.relics,
  r.killed_by,
  rank() over (partition by r.daily_no order by r.floor desc, r.kills desc, r.turns asc) as rank
from public.runs r
join public.profiles p on p.id = r.user_id
where r.mode = 'daily';

-- Each player's single best endless run.
create or replace view public.leaderboard_endless with (security_invoker = on) as
select b.*, rank() over (order by b.floor desc, b.kills desc, b.turns asc) as rank
from (
  select distinct on (r.user_id)
    r.user_id, p.name, r.floor, r.kills, r.turns, r.relics, r.killed_by, r.created_at
  from public.runs r
  join public.profiles p on p.id = r.user_id
  where r.mode = 'endless'
  order by r.user_id, r.floor desc, r.kills desc, r.turns asc
) b;

grant select on public.leaderboard_daily, public.leaderboard_endless to anon, authenticated;
grant select on public.profiles, public.runs to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant insert on public.runs to authenticated;

-- Tell the API to pick up any new columns straight away.
notify pgrst, 'reload schema';
