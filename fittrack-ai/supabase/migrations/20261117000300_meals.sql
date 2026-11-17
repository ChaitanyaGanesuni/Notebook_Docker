-- Food reference list, meal entries and saved meals.

-- user_id null = shared seed row (read-only to users); otherwise the user's own addition.
create table public.food_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  serving    text not null default '1 serving',
  kcal       numeric(6,1) not null check (kcal between 0 and 5000),
  protein_g  numeric(5,1) not null default 0 check (protein_g between 0 and 300),
  carbs_g    numeric(5,1) not null default 0 check (carbs_g between 0 and 1000),
  fat_g      numeric(5,1) not null default 0 check (fat_g between 0 and 500),
  fibre_g    numeric(5,1) not null default 0 check (fibre_g between 0 and 200),
  junk       boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index food_items_name on public.food_items (lower(name));
create index food_items_user on public.food_items (user_id);

create table public.meal_entries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  date            date not null,
  slot            text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snacks')),
  source          text not null default 'home' check (source in ('home', 'canteen', 'ordered')),
  logged_at       timestamptz not null default now(),
  text            text not null default '' check (char_length(text) <= 2000),   -- what the user typed
  photo_path      text,                                   -- object path in the private meal-photos bucket
  name            text not null default '',
  -- Current values. Null while an estimate is pending or failed: the entry is saved first, numbers later.
  kcal            numeric(6,1) check (kcal between 0 and 5000),
  protein_g       numeric(5,1) check (protein_g between 0 and 300),
  carbs_g         numeric(5,1) check (carbs_g between 0 and 1000),
  fat_g           numeric(5,1) check (fat_g between 0 and 500),
  fibre_g         numeric(5,1) check (fibre_g between 0 and 200),
  sugar_g         numeric(5,1) check (sugar_g between 0 and 1000),
  sodium_mg       numeric(7,1) check (sodium_mg between 0 and 50000),
  junk            boolean not null default false,
  ai_estimate     jsonb,                                  -- original AI estimate, never overwritten by edits
  estimate_status text not null default 'none' check (estimate_status in ('none', 'pending', 'done', 'failed')),
  confidence      text check (confidence in ('low', 'medium', 'high')),
  assumption      text,
  edited          boolean not null default false,         -- "Your numbers"
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, user_id)
);
create index meal_entries_user_date on public.meal_entries (user_id, date, slot);

create table public.meal_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  entry_id   uuid not null,
  position   int not null default 0,
  name       text not null check (char_length(name) between 1 and 120),
  qty        text not null default '',
  kcal       numeric(6,1) check (kcal between 0 and 5000),
  protein_g  numeric(5,1) check (protein_g between 0 and 300),
  carbs_g    numeric(5,1) check (carbs_g between 0 and 1000),
  fat_g      numeric(5,1) check (fat_g between 0 and 500),
  fibre_g    numeric(5,1) check (fibre_g between 0 and 200),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- the item must belong to the same user as its entry
  foreign key (entry_id, user_id) references public.meal_entries (id, user_id) on delete cascade
);
create index meal_items_entry on public.meal_items (entry_id, position);
create index meal_items_user on public.meal_items (user_id);

create table public.saved_meals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  slot       text check (slot in ('breakfast', 'lunch', 'dinner', 'snacks')),
  source     text check (source in ('home', 'canteen', 'ordered')),
  kcal       numeric(6,1) check (kcal between 0 and 5000),
  protein_g  numeric(5,1) check (protein_g between 0 and 300),
  carbs_g    numeric(5,1) check (carbs_g between 0 and 1000),
  fat_g      numeric(5,1) check (fat_g between 0 and 500),
  fibre_g    numeric(5,1) check (fibre_g between 0 and 200),
  junk       boolean not null default false,
  items      jsonb not null default '[]'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_meals_user on public.saved_meals (user_id);
