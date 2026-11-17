-- Profile, targets, programme and the per-day logs.

create table public.profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  display_name   text not null check (char_length(display_name) between 1 and 60),
  sex            text not null check (sex in ('male', 'female')),   -- BMR formula and default track only
  age            int  not null check (age between 18 and 100),      -- adults only
  height_cm      numeric(5,1) not null check (height_cm between 100 and 250),
  goal           text not null default '',
  fat_storage    text not null default '',
  job            text not null default '',
  wake_time      time not null default '07:00',
  bed_time       time not null default '23:30',
  daily_activity text not null default '',
  training       text not null default '',
  strength_level text not null default '',
  diet           text not null default '',
  food_sources   text not null default '',
  weak_spots     text not null default '',
  timezone       text not null default 'Asia/Kolkata',
  default_track  text not null default 'men'  check (default_track in ('men', 'women', 'couples')),
  demo_presenter text not null default 'male' check (demo_presenter in ('female', 'male')),
  onboarded_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.targets (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  kcal_target           int not null default 2050 check (kcal_target between 1400 and 5000),
  kcal_min              int not null default 2000 check (kcal_min between 1400 and 5000),
  kcal_max              int not null default 2100 check (kcal_max between 1400 and 5000),
  protein_target_g      int not null default 130 check (protein_target_g between 30 and 300),
  protein_min_g         int not null default 120 check (protein_min_g between 30 and 300),
  protein_max_g         int not null default 140 check (protein_max_g between 30 and 300),
  fat_min_g             int not null default 50  check (fat_min_g between 10 and 300),
  fat_max_g             int not null default 65  check (fat_max_g between 10 and 300),
  fibre_min_g           int not null default 25  check (fibre_min_g between 0 and 100),
  fibre_max_g           int not null default 30  check (fibre_max_g between 0 and 100),
  water_ml              int not null default 3000  check (water_ml between 500 and 10000),
  steps                 int not null default 10000 check (steps between 1000 and 50000),
  workouts_per_week     int not null default 3 check (workouts_per_week between 0 and 7),
  bedtime_target        time not null default '23:30',
  sleep_min_h           numeric(3,1) not null default 7 check (sleep_min_h between 3 and 14),
  sleep_max_h           numeric(3,1) not null default 8 check (sleep_max_h between 3 and 14),
  add_exercise_calories boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (kcal_min <= kcal_target and kcal_target <= kcal_max),
  check (protein_min_g <= protein_target_g and protein_target_g <= protein_max_g),
  check (fat_min_g <= fat_max_g),
  check (fibre_min_g <= fibre_max_g),
  check (sleep_min_h <= sleep_max_h)
);

create table public.programmes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null default '',
  start_date      date not null,
  weeks           int  not null check (weeks between 1 and 52),
  checkpoint_date date,
  expectation     text not null default '',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (checkpoint_date is null or checkpoint_date >= start_date)
);
create unique index programmes_one_active on public.programmes (user_id) where is_active;
create index programmes_user on public.programmes (user_id, start_date);

-- One row per user per local date (Asia/Kolkata by default; see profiles.timezone).
create table public.day_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  date            date not null,
  water_ml        int not null default 0 check (water_ml between 0 and 20000),
  steps           int check (steps between 0 and 200000),      -- null = not logged yet
  steps_source    text check (steps_source in ('manual', 'health')),
  badminton       boolean not null default false,
  workout_done    boolean not null default false,
  in_bed_on_time  boolean not null default false,
  chai_sugar      text check (chai_sugar in ('full', 'half', 'none')),
  note            text not null default '' check (char_length(note) <= 4000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, date)
);

create table public.weight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null,
  weight_kg  numeric(4,1) not null check (weight_kg between 20 and 300),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.body_measurements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null,
  waist_cm   numeric(4,1) check (waist_cm between 30 and 250),   -- at the navel
  hip_cm     numeric(4,1) check (hip_cm between 30 and 250),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.sleep_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  date         date not null,                 -- local date of the night's bedtime
  bed_at       timestamptz,
  wake_at      timestamptz,
  duration_min int check (duration_min between 0 and 1440),
  source       text not null default 'manual' check (source in ('manual', 'health')),
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, date),
  check (bed_at is null or wake_at is null or wake_at > bed_at)
);

create table public.progress_photos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null,
  photo_path text not null,                   -- object path in the private progress-photos bucket
  note       text not null default '',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index progress_photos_user_date on public.progress_photos (user_id, date);

create table public.notification_preferences (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in
               ('weigh_in', 'breakfast', 'lunch', 'dinner', 'water', 'workout', 'evening_review', 'waist')),
  enabled    boolean not null default false,
  time       time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);
