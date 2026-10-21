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

-- Names are unique ignoring capitals: "Jstn" can't be claimed once "JSTN" exists.
-- A trigger rather than a unique index, so names that already clash keep working.
create or replace function public.profile_name_free() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.name is distinct from old.name then
    if exists (select 1 from public.profiles p where lower(p.name) = lower(new.name) and p.id <> new.id) then
      raise exception 'That name is already taken.' using errcode = 'unique_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profile_name_free on public.profiles;
create trigger profile_name_free before insert or update of name on public.profiles
  for each row execute function public.profile_name_free();

create index if not exists profiles_lower_name on public.profiles (lower(name));

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

-- ---------- daily reminders (web push) ----------
-- Sent hourly by .github/workflows/reminders.yml. Players only reach these through the
-- functions below; the tables themselves are private.

-- The notification keys. The reminder job makes them on its first run.
create table if not exists public.push_config (
  id int primary key default 1 check (id = 1),
  public_key text not null,
  private_key text not null,
  created_at timestamptz not null default now()
);
alter table public.push_config enable row level security;

-- One row per device that asked for reminders.
create table if not exists public.push_subs (
  endpoint text primary key check (length(endpoint) <= 1000),
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null check (length(p256dh) <= 200),
  auth text not null check (length(auth) <= 100),
  tz text not null default 'America/Chicago' check (length(tz) <= 64),
  morning boolean not null default true,
  evening boolean not null default true,
  last_morning date,
  last_evening date,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
create index if not exists push_subs_user on public.push_subs (user_id);

revoke all on public.push_config, public.push_subs from anon, authenticated;

create or replace function public.push_public_key() returns text
language sql stable security definer set search_path = public as $$
  select public_key from public.push_config where id = 1
$$;

-- Sign this device up (or change its choices). The endpoint is secret to the browser that
-- made it, so whoever sends it owns it.
create or replace function public.save_push(p_endpoint text, p_p256dh text, p_auth text, p_tz text, p_morning boolean, p_evening boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in.'; end if;
  if p_endpoint !~ '^https://' then raise exception 'Not a push address.'; end if;
  insert into public.push_subs (endpoint, user_id, p256dh, auth, tz, morning, evening)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, coalesce(nullif(left(p_tz, 64), ''), 'America/Chicago'), p_morning, p_evening)
  on conflict (endpoint) do update set
    user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    tz = excluded.tz, morning = excluded.morning, evening = excluded.evening;
  -- At most 10 devices per player.
  delete from public.push_subs where endpoint in (
    select endpoint from public.push_subs where user_id = auth.uid() order by created_at desc offset 10
  );
end $$;

create or replace function public.drop_push(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subs where endpoint = p_endpoint
$$;

revoke execute on function public.push_public_key(), public.save_push(text, text, text, text, boolean, boolean), public.drop_push(text) from public;
grant execute on function public.push_public_key() to anon, authenticated;
grant execute on function public.save_push(text, text, text, text, boolean, boolean), public.drop_push(text) to authenticated;

notify pgrst, 'reload schema';

-- ---------- installed app (for the stats dashboard) ----------
-- `app` marks a day the device opened the game as the installed app. `installs` records the
-- browser's own "app installed" event, once per device. Same random device id, no personal data.

alter table public.activity add column if not exists app boolean not null default false;

create table if not exists public.installs (
  device text primary key check (length(device) between 8 and 64),
  at timestamptz not null default now()
);
alter table public.installs enable row level security;

-- ping gains p_app. Replaced rather than overloaded, so older copies of the game still work.
drop function if exists public.ping(text, boolean);
create or replace function public.ping(p_device text, p_played boolean default false, p_app boolean default false)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.activity (device, played, app)
  values (p_device, coalesce(p_played, false), coalesce(p_app, false))
  on conflict (device, day) do update
    set last_seen = now(),
        played = public.activity.played or excluded.played,
        app = public.activity.app or excluded.app;
$$;
revoke all on function public.ping(text, boolean, boolean) from public;
grant execute on function public.ping(text, boolean, boolean) to anon, authenticated;

create or replace function public.note_install(p_device text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.installs (device) values (p_device) on conflict (device) do nothing;
$$;
revoke all on function public.note_install(text) from public;
grant execute on function public.note_install(text) to anon, authenticated;

-- The dashboard's numbers, now with the installed app.
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
    'app', json_build_object(
      'installs', (select count(*) from installs),
      'installs_today', (select count(*) from installs, today where at >= (today.d::timestamp at time zone 'America/Chicago')),
      'devices', (select count(distinct device) from activity where app),
      'today', (select count(*) from activity, today where day = today.d and app),
      'reminders', (select count(*) from push_subs),
      'reminder_players', (select count(distinct user_id) from push_subs),
      'since', (select min(at) from installs)
    ),
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

-- ---------- endless leaderboard by period ----------
-- Each player's best endless run today or this week (Central Time: days start at midnight,
-- weeks on Monday), ranked like leaderboard_endless. 'all' covers every run.
create index if not exists runs_endless_recent on public.runs (created_at) where mode = 'endless';

create or replace function public.endless_board(p_period text)
returns table (
  user_id uuid, name text, floor int, kills int, turns int, relics text, killed_by text, created_at timestamptz,
  rank bigint, title text, earned bigint, hero text, outfit_look text, outfit_head text, seconds int
)
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select case p_period
      when 'day' then date_trunc('day', now() at time zone 'America/Chicago') at time zone 'America/Chicago'
      when 'week' then date_trunc('week', now() at time zone 'America/Chicago') at time zone 'America/Chicago'
      else '-infinity'::timestamptz
    end as since
  ),
  best as (
    select distinct on (r.user_id)
      r.user_id, r.floor, r.kills, r.turns, r.relics, r.killed_by, r.created_at, r.seconds, r.log
    from public.runs r, bounds b
    where r.mode = 'endless' and r.created_at >= b.since
    order by r.user_id, r.floor desc, r.kills desc, r.turns asc
  )
  select
    b.user_id, p.name, b.floor, b.kills, b.turns, b.relics, b.killed_by, b.created_at,
    rank() over (order by b.floor desc, b.kills desc, b.turns asc),
    left(p.meta->>'title', 40),
    case when jsonb_typeof(p.meta->'earned') = 'number' then least(greatest((p.meta->>'earned')::numeric, 0), 1000000000)::bigint else 0 end,
    h.hero,
    left(coalesce(p.meta->'outfits'->h.hero->>'look', p.meta->>'look'), 24),
    left(p.meta->'outfits'->h.hero->>'head', 24),
    b.seconds
  from best b
  join public.profiles p on p.id = b.user_id
  cross join lateral (select substring(b.log from '^#[0-9]+\|([a-z]+)\|') as hero) h
$$;
grant execute on function public.endless_board(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ---------- rival alerts and weekly Endless prizes ----------

-- Rival alerts: on unless turned off, and what the reminder job last saw (ranks, alerts sent today).
alter table public.push_subs add column if not exists rivals boolean not null default true;
alter table public.push_subs add column if not exists rival jsonb not null default '{}'::jsonb;

-- save_push gains p_rivals. Replaced rather than overloaded, so the call stays unambiguous.
drop function if exists public.save_push(text, text, text, text, boolean, boolean);
create or replace function public.save_push(p_endpoint text, p_p256dh text, p_auth text, p_tz text, p_morning boolean, p_evening boolean, p_rivals boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in.'; end if;
  if p_endpoint !~ '^https://' then raise exception 'Not a push address.'; end if;
  insert into public.push_subs (endpoint, user_id, p256dh, auth, tz, morning, evening, rivals)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, coalesce(nullif(left(p_tz, 64), ''), 'America/Chicago'), p_morning, p_evening, coalesce(p_rivals, true))
  on conflict (endpoint) do update set
    user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    tz = excluded.tz, morning = excluded.morning, evening = excluded.evening, rivals = excluded.rivals;
  -- At most 10 devices per player.
  delete from public.push_subs where endpoint in (
    select endpoint from public.push_subs where user_id = auth.uid() order by created_at desc offset 10
  );
end $$;
revoke execute on function public.save_push(text, text, text, text, boolean, boolean, boolean) from public;
grant execute on function public.save_push(text, text, text, text, boolean, boolean, boolean) to authenticated;

-- One finished week of the Endless board (Monday to Sunday, Central Time), for the weekly prizes.
create or replace function public.endless_week(p_week date)
returns table (user_id uuid, name text, floor int, rank bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with best as (
    select distinct on (r.user_id) r.user_id, r.floor, r.kills, r.turns
    from public.runs r
    where r.mode = 'endless'
      and r.created_at >= (p_week::timestamp at time zone 'America/Chicago')
      and r.created_at < ((p_week + 7)::timestamp at time zone 'America/Chicago')
    order by r.user_id, r.floor desc, r.kills desc, r.turns asc
  )
  select b.user_id, p.name, b.floor, rank() over (order by b.floor desc, b.kills desc, b.turns asc)
  from best b
  join public.profiles p on p.id = b.user_id
$$;
grant execute on function public.endless_week(date) to anon, authenticated;

notify pgrst, 'reload schema';

-- ---------- story: summoned ghosts ----------
-- One row each time a player summons another player's ghost; the summoned player is thanked in Souls.
create table if not exists public.summons (
  id bigint generated always as identity primary key,
  summoned uuid not null references auth.users (id) on delete cascade,
  by_user uuid not null references auth.users (id) on delete cascade,
  chapter int not null check (chapter between 1 and 100),
  at timestamptz not null default now()
);
alter table public.summons enable row level security;
create index if not exists summons_summoned on public.summons (summoned, at);
revoke all on public.summons from anon, authenticated;

create or replace function public.note_summon(p_name text, p_chapter int)
returns void language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  if auth.uid() is null then return; end if;
  select id into target from public.profiles where name = p_name;
  if target is null or target = auth.uid() then return; end if;
  if exists (select 1 from public.summons where by_user = auth.uid() and summoned = target and at > now() - interval '10 minutes') then return; end if;
  insert into public.summons (summoned, by_user, chapter) values (target, auth.uid(), least(greatest(p_chapter, 1), 100));
end $$;
revoke execute on function public.note_summon(text, int) from public;
grant execute on function public.note_summon(text, int) to authenticated;

create or replace function public.my_summons(p_since timestamptz)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.summons where summoned = auth.uid() and at > p_since
$$;
revoke execute on function public.my_summons(timestamptz) from public;
grant execute on function public.my_summons(timestamptz) to authenticated;

notify pgrst, 'reload schema';

-- ---------- run funnel (anonymous, per device) ----------
-- Where players drop off: who taps the title screen, who starts a run, the floor they
-- were on when they left mid-run, and who finished without an account (so their run
-- never reached a leaderboard). One row per device, day and mode; no names.
create table if not exists public.run_funnel (
  device text not null check (length(device) between 8 and 64),
  day date not null default ((now() at time zone 'America/Chicago')::date),
  mode text not null check (mode in ('daily', 'endless', 'title')),
  started boolean not null default false,
  ended boolean not null default false,
  signed boolean not null default false,
  quit_floor int,
  end_floor int,
  tapped boolean not null default false,
  tutorial boolean not null default false,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (device, day, mode)
);
alter table public.run_funnel enable row level security;
create index if not exists run_funnel_day on public.run_funnel (day);

create or replace function public.note_run(p_device text, p_mode text, p_event text, p_floor int default null, p_signed boolean default false)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.run_funnel (device, mode, started, ended, signed, quit_floor, end_floor, tapped, tutorial)
  select p_device, p_mode, p_event = 'start', p_event = 'end', p_event = 'end' and coalesce(p_signed, false),
    case when p_event = 'quit' then least(greatest(p_floor, 0), 100000) end,
    case when p_event = 'end' then least(greatest(p_floor, 0), 100000) end,
    p_event = 'tap', p_event = 'tutorial'
  where p_event in ('start', 'end', 'quit', 'tap', 'tutorial')
  on conflict (device, day, mode) do update set
    last_seen = now(),
    started = public.run_funnel.started or excluded.started,
    ended = public.run_funnel.ended or excluded.ended,
    signed = public.run_funnel.signed or excluded.signed,
    quit_floor = coalesce(excluded.quit_floor, public.run_funnel.quit_floor),
    end_floor = greatest(public.run_funnel.end_floor, excluded.end_floor),
    tapped = public.run_funnel.tapped or excluded.tapped,
    tutorial = public.run_funnel.tutorial or excluded.tutorial;
$$;
revoke all on function public.note_run(text, text, text, int, boolean) from public;
grant execute on function public.note_run(text, text, text, int, boolean) to anon, authenticated;

-- The funnel for the dashboard: the last 7 days, and where unfinished runs stopped.
create or replace function public.crypt_funnel()
returns json
language sql
stable
security definer
set search_path = public
as $$
  with t as (select (now() at time zone 'America/Chicago')::date as d),
  days as (select (t.d - g)::date as day from t, generate_series(0, 6) g),
  f as (select * from public.run_funnel, t where day > t.d - 7)
  select json_build_object(
    'days', (select json_agg(json_build_object(
      'day', days.day,
      'visitors', (select count(*) from public.activity a where a.day = days.day),
      'tapped', (select count(*) from f where f.day = days.day and f.mode = 'title' and f.tapped),
      'tutorial', (select count(*) from f where f.day = days.day and f.mode = 'title' and f.tutorial),
      'daily_started', (select count(*) from f where f.day = days.day and f.mode = 'daily' and f.started),
      'daily_ended', (select count(*) from f where f.day = days.day and f.mode = 'daily' and f.started and f.ended),
      'daily_signed', (select count(*) from f where f.day = days.day and f.mode = 'daily' and f.started and f.ended and f.signed),
      'endless_started', (select count(*) from f where f.day = days.day and f.mode = 'endless' and f.started),
      'endless_ended', (select count(*) from f where f.day = days.day and f.mode = 'endless' and f.started and f.ended)
    ) order by days.day desc) from days),
    'quit_floors', (select json_object_agg(mode, b) from (
      select mode, json_build_object(
        '1-2', count(*) filter (where quit_floor between 0 and 2),
        '3-5', count(*) filter (where quit_floor between 3 and 5),
        '6-10', count(*) filter (where quit_floor between 6 and 10),
        '11-20', count(*) filter (where quit_floor between 11 and 20),
        '21+', count(*) filter (where quit_floor > 20),
        'unknown', count(*) filter (where quit_floor is null)
      ) as b
      from f where mode in ('daily', 'endless') and started and not ended group by mode
    ) s),
    'since', (select min(first_seen) from public.run_funnel)
  );
$$;
revoke all on function public.crypt_funnel() from public, anon, authenticated;

notify pgrst, 'reload schema';

-- ---------- patrons ----------
-- Supporters on Ko-fi, added by hand. Each player can only see their own row; signing in
-- with a row here unlocks the "Patron of the Crypt" title.
-- To add one: insert into public.patrons (user_id) select id from public.profiles where name = 'TheirName';
create table if not exists public.patrons (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.patrons enable row level security;
drop policy if exists "patrons read own" on public.patrons;
create policy "patrons read own" on public.patrons for select using (auth.uid() = user_id);

-- ---------- traffic sources (for the stats dashboard) ----------
-- Where visits come from: a tagged link (?ref=reddit), the referring site's name, itch,
-- the installed app, or direct. One row per device per day per source; `first_visit`
-- marks the source a device first arrived from. Same random device id, no personal data.
create table if not exists public.visit_sources (
  device text not null check (length(device) between 8 and 64),
  day date not null default ((now() at time zone 'America/Chicago')::date),
  source text not null check (source ~ '^[a-z0-9._-]{1,40}$'),
  host text not null default '',
  first_visit boolean not null default false,
  at timestamptz not null default now(),
  primary key (device, day, source)
);
alter table public.visit_sources enable row level security;

create or replace function public.note_source(p_device text, p_source text, p_host text default '')
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.visit_sources (device, source, host, first_visit)
  select p_device,
    case when lower(p_source) ~ '^[a-z0-9._-]{1,40}$' then lower(p_source) else 'other' end,
    left(regexp_replace(lower(coalesce(p_host, '')), '[^a-z0-9._-]', '', 'g'), 60),
    not exists (select 1 from public.visit_sources v where v.device = p_device)
  where length(p_device) between 8 and 64
  on conflict (device, day, source) do nothing;
$$;
revoke all on function public.note_source(text, text, text) from public;
grant execute on function public.note_source(text, text, text) to anon, authenticated;

-- For the dashboard: visitors and players by source today and this week, where new
-- players first came from (and how many came back another day), and the top referring sites.
create or replace function public.crypt_sources()
returns json
language sql
stable
security definer
set search_path = public
as $$
  with t as (select (now() at time zone 'America/Chicago')::date as d),
  v as (
    select s.*, coalesce(a.played, false) as played
    from public.visit_sources s left join public.activity a on a.device = s.device and a.day = s.day
  )
  select json_build_object(
    'today', (select json_agg(r order by r.visitors desc) from (
      select source, count(*) as visitors, count(*) filter (where played) as players
      from v, t where v.day = t.d group by source) r),
    'week', (select json_agg(r order by r.visitors desc) from (
      select source, count(distinct device) as visitors, count(distinct device) filter (where played) as players
      from v, t where v.day > t.d - 7 group by source) r),
    'first', (select json_agg(r order by r.visitors desc) from (
      select f.source, count(*) as visitors,
        count(*) filter (where exists (select 1 from public.activity a where a.device = f.device and a.played)) as players,
        count(*) filter (where (select count(distinct a.day) from public.activity a where a.device = f.device) > 1) as returned
      from public.visit_sources f where f.first_visit group by f.source) r),
    'hosts', (select json_agg(r order by r.visits desc) from (
      select host, count(*) as visits from v, t where v.day > t.d - 7 and host <> '' group by host order by count(*) desc limit 12) r),
    'since', (select min(at) from public.visit_sources)
  );
$$;
revoke all on function public.crypt_sources() from public, anon, authenticated;

notify pgrst, 'reload schema';

-- ---------- auras on the leaderboards ----------
-- Each board row also carries the aura the player radiates on that hero (outfit_aura, added last).
create or replace view public.leaderboard_daily with (security_invoker = on) as select r.daily_no, r.user_id, p.name, r.floor, r.kills, r.turns, r.relics, r.killed_by, rank() over (partition by r.daily_no order by r.floor desc, r.kills desc, r.turns asc) as rank, left(p.meta->>'title', 40) as title, case when jsonb_typeof(p.meta->'earned') = 'number' then least(greatest((p.meta->>'earned')::numeric, 0), 1000000000)::bigint else 0 end as earned, h.hero, left(coalesce(p.meta->'outfits'->h.hero->>'look', p.meta->>'look'), 24) as outfit_look, left(p.meta->'outfits'->h.hero->>'head', 24) as outfit_head, r.seconds, left(p.meta->'outfits'->h.hero->>'aura', 24) as outfit_aura from public.runs r join public.profiles p on p.id = r.user_id cross join lateral (select substring(r.log from '^#[0-9]+\|([a-z]+)\|') as hero) h where r.mode = 'daily';
create or replace view public.leaderboard_endless with (security_invoker = on) as select b.*, rank() over (order by b.floor desc, b.kills desc, b.turns asc) as rank, left(p2.meta->>'title', 40) as title, case when jsonb_typeof(p2.meta->'earned') = 'number' then least(greatest((p2.meta->>'earned')::numeric, 0), 1000000000)::bigint else 0 end as earned, h.hero, left(coalesce(p2.meta->'outfits'->h.hero->>'look', p2.meta->>'look'), 24) as outfit_look, left(p2.meta->'outfits'->h.hero->>'head', 24) as outfit_head, h.seconds, left(p2.meta->'outfits'->h.hero->>'aura', 24) as outfit_aura from (select distinct on (r.user_id) r.user_id, p.name, r.floor, r.kills, r.turns, r.relics, r.killed_by, r.created_at from public.runs r join public.profiles p on p.id = r.user_id where r.mode = 'endless' order by r.user_id, r.floor desc, r.kills desc, r.turns asc) b join public.profiles p2 on p2.id = b.user_id cross join lateral (select substring(r2.log from '^#[0-9]+\|([a-z]+)\|') as hero, r2.seconds from public.runs r2 where r2.user_id = b.user_id and r2.mode = 'endless' and r2.floor = b.floor and r2.kills = b.kills and r2.turns = b.turns limit 1) h;
drop function if exists public.endless_board(text);
create function public.endless_board(p_period text) returns table (user_id uuid, name text, floor int, kills int, turns int, relics text, killed_by text, created_at timestamptz, rank bigint, title text, earned bigint, hero text, outfit_look text, outfit_head text, seconds int, outfit_aura text) language sql stable security invoker set search_path = public as $$ with bounds as (select case p_period when 'day' then date_trunc('day', now() at time zone 'America/Chicago') at time zone 'America/Chicago' when 'week' then date_trunc('week', now() at time zone 'America/Chicago') at time zone 'America/Chicago' else '-infinity'::timestamptz end as since), best as (select distinct on (r.user_id) r.user_id, r.floor, r.kills, r.turns, r.relics, r.killed_by, r.created_at, r.seconds, r.log from public.runs r, bounds b where r.mode = 'endless' and r.created_at >= b.since order by r.user_id, r.floor desc, r.kills desc, r.turns asc) select b.user_id, p.name, b.floor, b.kills, b.turns, b.relics, b.killed_by, b.created_at, rank() over (order by b.floor desc, b.kills desc, b.turns asc), left(p.meta->>'title', 40), case when jsonb_typeof(p.meta->'earned') = 'number' then least(greatest((p.meta->>'earned')::numeric, 0), 1000000000)::bigint else 0 end, h.hero, left(coalesce(p.meta->'outfits'->h.hero->>'look', p.meta->>'look'), 24), left(p.meta->'outfits'->h.hero->>'head', 24), b.seconds, left(p.meta->'outfits'->h.hero->>'aura', 24) from best b join public.profiles p on p.id = b.user_id cross join lateral (select substring(b.log from '^#[0-9]+\|([a-z]+)\|') as hero) h $$;
grant execute on function public.endless_board(text) to anon, authenticated;
grant select on public.leaderboard_daily, public.leaderboard_endless to anon, authenticated;
notify pgrst, 'reload schema';

-- ---------- challenge links ----------
-- A player turns an Endless run into a link; friends play the same crypt and hero and race
-- its board. Written only through the functions below; boards are read through them too.
create table if not exists public.challenges (code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'), user_id uuid not null references auth.users (id) on delete cascade, seed bigint not null, head text not null check (length(head) <= 300), floor int not null check (floor between 1 and 500), kills int not null check (kills between 0 and 20000), turns int not null check (turns between 0 and 200000), log text not null default '' check (length(log) <= 200000), created_at timestamptz not null default now());
create table if not exists public.challenge_runs (code text not null references public.challenges (code) on delete cascade, user_id uuid not null references auth.users (id) on delete cascade, floor int not null check (floor between 1 and 500), kills int not null check (kills between 0 and 20000), turns int not null check (turns between 0 and 200000), log text not null default '' check (length(log) <= 200000), created_at timestamptz not null default now(), primary key (code, user_id));
alter table public.challenges enable row level security;
alter table public.challenge_runs enable row level security;
create or replace function public.create_challenge(p_seed bigint, p_head text, p_floor int, p_kills int, p_turns int, p_log text) returns text language plpgsql security definer set search_path = public as $$ declare v_code text; v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; begin if auth.uid() is null then raise exception 'Sign in to make a challenge.'; end if; if (select count(*) from public.challenges where user_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then raise exception 'That''s plenty of challenges for today. Try again tomorrow.'; end if; if p_head !~ '^#[0-9]+\|[a-z]+\|[a-z,]*\|' then raise exception 'Not a run.'; end if; loop v_code := ''; for i in 1..6 loop v_code := v_code || substr(v_alpha, 1 + floor(random() * 32)::int, 1); end loop; exit when not exists (select 1 from public.challenges where code = v_code); end loop; insert into public.challenges (code, user_id, seed, head, floor, kills, turns, log) values (v_code, auth.uid(), p_seed, left(p_head, 300), p_floor, p_kills, p_turns, coalesce(p_log, '')); return v_code; end; $$;
revoke all on function public.create_challenge(bigint, text, int, int, int, text) from public;
grant execute on function public.create_challenge(bigint, text, int, int, int, text) to authenticated;
create or replace function public.submit_challenge_run(p_code text, p_floor int, p_kills int, p_turns int, p_log text) returns void language plpgsql security definer set search_path = public as $$ begin if auth.uid() is null then raise exception 'Sign in to post to the challenge board.'; end if; if not exists (select 1 from public.challenges where code = upper(p_code)) then raise exception 'That challenge doesn''t exist.'; end if; insert into public.challenge_runs (code, user_id, floor, kills, turns, log) values (upper(p_code), auth.uid(), p_floor, p_kills, p_turns, coalesce(p_log, '')) on conflict (code, user_id) do update set floor = excluded.floor, kills = excluded.kills, turns = excluded.turns, log = excluded.log, created_at = now() where (excluded.floor, excluded.kills, -excluded.turns) > (public.challenge_runs.floor, public.challenge_runs.kills, -public.challenge_runs.turns); end; $$;
revoke all on function public.submit_challenge_run(text, int, int, int, text) from public;
grant execute on function public.submit_challenge_run(text, int, int, int, text) to authenticated;
create or replace function public.challenge_get(p_code text) returns table (code text, name text, user_id uuid, seed bigint, head text, floor int, kills int, turns int, created_at timestamptz, players bigint) language sql stable security definer set search_path = public as $$ select c.code, p.name, c.user_id, c.seed, c.head, c.floor, c.kills, c.turns, c.created_at, (select count(*) from public.challenge_runs r where r.code = c.code) from public.challenges c join public.profiles p on p.id = c.user_id where c.code = upper(p_code) $$;
grant execute on function public.challenge_get(text) to anon, authenticated;
create or replace function public.challenge_board(p_code text) returns table (rank bigint, user_id uuid, name text, floor int, kills int, turns int, creator boolean, title text, earned bigint) language sql stable security definer set search_path = public as $$ with entries as (select c.user_id, c.floor, c.kills, c.turns, true as creator from public.challenges c where c.code = upper(p_code) union all select r.user_id, r.floor, r.kills, r.turns, false from public.challenge_runs r join public.challenges c on c.code = r.code where r.code = upper(p_code) and r.user_id <> c.user_id) select rank() over (order by e.floor desc, e.kills desc, e.turns asc), e.user_id, p.name, e.floor, e.kills, e.turns, e.creator, left(p.meta->>'title', 40), case when jsonb_typeof(p.meta->'earned') = 'number' then least(greatest((p.meta->>'earned')::numeric, 0), 1000000000)::bigint else 0 end from entries e join public.profiles p on p.id = e.user_id order by 1, 3 limit 50 $$;
grant execute on function public.challenge_board(text) to anon, authenticated;
create or replace function public.challenge_news(p_since timestamptz) returns table (code text, name text, floor int, my_floor int, at timestamptz) language sql stable security definer set search_path = public as $$ select c.code, p.name, r.floor, c.floor, r.created_at from public.challenge_runs r join public.challenges c on c.code = r.code join public.profiles p on p.id = r.user_id where c.user_id = auth.uid() and r.user_id <> auth.uid() and r.created_at > p_since and (r.floor, r.kills, -r.turns) > (c.floor, c.kills, -c.turns) order by r.created_at desc limit 20 $$;
grant execute on function public.challenge_news(timestamptz) to authenticated;
notify pgrst, 'reload schema';
