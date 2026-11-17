-- Exercise library, tracks, sessions and partner links.

-- user_id null = shared library row; otherwise a user's custom exercise.
create table public.exercises (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users (id) on delete cascade,
  slug           text not null,
  name           text not null,
  kind           text not null check (kind in ('reps', 'reps_per_side', 'max_reps', 'timed', 'rounds')),
  default_target int,
  cues           text[] not null default '{}',
  progression    text not null default '',
  is_pair        boolean not null default false,
  form_video_url text,
  -- { "female": asset|null, "male": asset|null, "pair": asset|null }; null = Skia fallback figure
  demo_variants  jsonb not null default '{"female": null, "male": null, "pair": null}'::jsonb
                 check (demo_variants ?& array['female', 'male', 'pair']),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index exercises_shared_slug on public.exercises (slug) where user_id is null;
create unique index exercises_user_slug on public.exercises (user_id, slug) where user_id is not null;

create table public.workout_tracks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users (id) on delete cascade,
  slug          text not null,
  name          text not null,
  description   text not null default '',
  sets_per_move int not null default 3 check (sets_per_move between 1 and 10),
  rest_seconds  int not null default 60 check (rest_seconds between 0 and 600),
  is_couples    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index workout_tracks_shared_slug on public.workout_tracks (slug) where user_id is null;
create unique index workout_tracks_user_slug on public.workout_tracks (user_id, slug) where user_id is not null;

create table public.track_exercises (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade,
  track_id    uuid not null references public.workout_tracks (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position    int not null,
  sets        int not null default 3 check (sets between 1 and 10),
  target      int,
  target_note text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (track_id, position)
);
create index track_exercises_user on public.track_exercises (user_id);

-- A link between two accounts. Created by invite, active only once accepted.
-- Accepting shares couples workout sessions and nothing else. Each person can
-- additionally share categories of their own data; the arrays below hold what
-- that person has switched on.
create table public.partner_links (
  id               uuid primary key default gen_random_uuid(),
  requester_id     uuid not null references auth.users (id) on delete cascade,
  addressee_id     uuid references auth.users (id) on delete cascade,
  invite_code      text not null unique,
  invite_expires_at timestamptz not null default now() + interval '7 days',
  status           text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  requester_shares text[] not null default '{}'
                   check (requester_shares <@ array['meals', 'weight', 'measurements', 'photos', 'coach']),
  addressee_shares text[] not null default '{}'
                   check (addressee_shares <@ array['meals', 'weight', 'measurements', 'photos', 'coach']),
  accepted_at      timestamptz,
  revoked_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (addressee_id is null or addressee_id <> requester_id),
  check (status <> 'accepted' or addressee_id is not null)
);
create index partner_links_requester on public.partner_links (requester_id);
create index partner_links_addressee on public.partner_links (addressee_id);

-- A workout as recorded in ONE account. A solo session is one row. A couples
-- session with a linked partner is written to both accounts: one row each,
-- tied together by couple_group_id, each with that person's own reps and
-- difficulty rating. A couples session with a guest is a single row in the
-- phone owner's account with a guest participant.
create table public.workout_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  date            date not null,
  track_id        uuid references public.workout_tracks (id) on delete set null,
  track_slug      text not null default '',
  is_couples      boolean not null default false,
  couple_group_id uuid,
  programme_week  int,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  duration_s      int check (duration_s between 0 and 86400),
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, user_id),
  check (couple_group_id is null or is_couples)
);
create index workout_sessions_user_date on public.workout_sessions (user_id, date);
create index workout_sessions_group on public.workout_sessions (couple_group_id) where couple_group_id is not null;

-- The people in this account's record of the session: the account holder, plus a guest if there was one.
create table public.session_participants (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  session_id      uuid not null,
  is_guest        boolean not null default false,
  guest_name      text check (guest_name is null or char_length(guest_name) <= 60),
  difficulty      int check (difficulty between 1 and 5),
  best_pushup_set int check (best_pushup_set between 0 and 500),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, user_id),
  foreign key (session_id, user_id) references public.workout_sessions (id, user_id) on delete cascade
);
create unique index session_participants_one_self on public.session_participants (session_id) where not is_guest;
create index session_participants_session on public.session_participants (session_id);
create index session_participants_user on public.session_participants (user_id);

create table public.exercise_sets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  session_id     uuid not null,
  participant_id uuid not null,
  exercise_id    uuid references public.exercises (id) on delete set null,
  exercise_slug  text not null,
  set_number     int not null check (set_number between 1 and 20),
  reps           int check (reps between 0 and 1000),
  hold_seconds   int check (hold_seconds between 0 and 3600),
  completed      boolean not null default true,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (session_id, user_id) references public.workout_sessions (id, user_id) on delete cascade,
  foreign key (participant_id, user_id) references public.session_participants (id, user_id) on delete cascade
);
create index exercise_sets_session on public.exercise_sets (session_id);
create index exercise_sets_user on public.exercise_sets (user_id, exercise_slug);
