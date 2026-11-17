-- Stored AI output, so reports are not regenerated on every open.

create table public.ai_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('daily', 'weekly')),
  period_start date not null,
  period_end   date not null,
  content      jsonb not null default '{}'::jsonb,
  body         text not null default '',
  model        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, kind, period_start),
  check (period_end >= period_start)
);

create table public.coach_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null check (char_length(content) between 1 and 20000),
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_messages_user on public.coach_messages (user_id, created_at);
