-- One More Crypt backend schema for Supabase.
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

-- Daily #1 is 2026-10-14 (Central Time). Must match src/daily.ts.
-- A new daily opens at midnight Central Time (America/Chicago: CST in winter, CDT in summer).
create or replace function public.current_daily_no() returns int
language sql stable as $$
  select ((now() at time zone 'America/Chicago')::date - date '2026-10-14') + 1
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

-- How long the run took, in seconds of active play (idle gaps are capped by the game).
-- Older runs have none.
alter table public.runs add column if not exists seconds int;
do $$ begin
  alter table public.runs add constraint runs_seconds_range check (seconds is null or seconds between 0 and 2000000);
exception when duplicate_object then null; end $$;

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
  rank() over (partition by r.daily_no order by r.floor desc, r.kills desc, r.turns asc) as rank,
  -- The player's equipped title id and lifetime Souls, for their Soul Rank. Players
  -- write their own meta, so the title is capped and the game only shows known ids.
  left(p.meta->>'title', 40) as title,
  case when jsonb_typeof(p.meta->'earned') = 'number' then least(greatest((p.meta->>'earned')::numeric, 0), 1000000000)::bigint else 0 end as earned,
  -- The hero played (from the run log's header) and the outfit the player dresses them in.
  h.hero,
  left(coalesce(p.meta->'outfits'->h.hero->>'look', p.meta->>'look'), 24) as outfit_look,
  left(p.meta->'outfits'->h.hero->>'head', 24) as outfit_head,
  r.seconds
from public.runs r
join public.profiles p on p.id = r.user_id
cross join lateral (select substring(r.log from '^#[0-9]+\|([a-z]+)\|') as hero) h
where r.mode = 'daily';

-- Each player's single best endless run.
create or replace view public.leaderboard_endless with (security_invoker = on) as
select b.*, rank() over (order by b.floor desc, b.kills desc, b.turns asc) as rank,
  left(p2.meta->>'title', 40) as title,
  case when jsonb_typeof(p2.meta->'earned') = 'number' then least(greatest((p2.meta->>'earned')::numeric, 0), 1000000000)::bigint else 0 end as earned,
  h.hero,
  left(coalesce(p2.meta->'outfits'->h.hero->>'look', p2.meta->>'look'), 24) as outfit_look,
  left(p2.meta->'outfits'->h.hero->>'head', 24) as outfit_head,
  h.seconds
from (
  select distinct on (r.user_id)
    r.user_id, p.name, r.floor, r.kills, r.turns, r.relics, r.killed_by, r.created_at
  from public.runs r
  join public.profiles p on p.id = r.user_id
  where r.mode = 'endless'
  order by r.user_id, r.floor desc, r.kills desc, r.turns asc
) b
join public.profiles p2 on p2.id = b.user_id
cross join lateral (
  select substring(r2.log from '^#[0-9]+\|([a-z]+)\|') as hero, r2.seconds
  from public.runs r2
  where r2.user_id = b.user_id and r2.mode = 'endless' and r2.floor = b.floor and r2.kills = b.kills and r2.turns = b.turns
  limit 1
) h;

grant select on public.leaderboard_daily, public.leaderboard_endless to anon, authenticated;
grant select on public.profiles, public.runs to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant insert on public.runs to authenticated;

-- Tell the API to pick up any new columns straight away.
notify pgrst, 'reload schema';

-- ---------- player activity (for the stats dashboard) ----------
-- One row per browser per day (Central Time, matching the daily crypt). The device id is a random string the game keeps in
-- local storage: no names, emails or IPs. `played` marks that a run was started that day.

create table if not exists public.activity (
  device text not null check (length(device) between 8 and 64),
  day date not null default ((now() at time zone 'America/Chicago')::date),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  played boolean not null default false,
  primary key (device, day)
);
-- No policies: nobody reads or writes the table directly, only through the functions below.
alter table public.activity enable row level security;
alter table public.activity alter column day set default ((now() at time zone 'America/Chicago')::date);
create index if not exists activity_last_seen on public.activity (last_seen);
create index if not exists activity_day on public.activity (day);

-- The game calls this when it loads, about once a minute while open, and when a run starts.
create or replace function public.ping(p_device text, p_played boolean default false)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.activity (device, played)
  values (p_device, coalesce(p_played, false))
  on conflict (device, day) do update
    set last_seen = now(), played = public.activity.played or excluded.played;
$$;
revoke all on function public.ping(text, boolean) from public;
grant execute on function public.ping(text, boolean) to anon, authenticated;

-- Everything the dashboard shows, in one call. Only the project owner can run it.
create or replace function public.crypt_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  with today as (select (now() at time zone 'America/Chicago')::date as d)
  select json_build_object(
    'online_now', (select count(*) from activity where last_seen > now() - interval '2 minutes'),
    'visitors_today', (select count(*) from activity, today where day = today.d),
    'players_today', (select count(*) from activity, today where day = today.d and played),
    'players_all', (select count(distinct device) from activity where played),
    'visitors_all', (select count(distinct device) from activity),
    'runs_today', (select count(*) from runs, today where created_at >= (today.d::timestamp at time zone 'America/Chicago')),
    'runs_all', (select count(*) from runs),
    'accounts', (select count(*) from profiles),
    'tracking_since', (select min(first_seen) from activity),
    'daily', coalesce((
      select json_agg(json_build_object('day', day, 'players', players, 'visitors', visitors) order by day)
      from (
        select day, count(*) filter (where played) as players, count(*) as visitors
        from activity, today
        where day > today.d - 14
        group by day
      ) s
    ), '[]'::json),
    'as_of', now()
  );
$$;
revoke all on function public.crypt_stats() from public, anon, authenticated;

notify pgrst, 'reload schema';
