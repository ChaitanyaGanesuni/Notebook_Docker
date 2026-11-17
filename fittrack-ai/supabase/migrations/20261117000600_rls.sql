-- Row-level security. Default: a user reaches only rows where user_id = auth.uid().
-- The single exception is an ACCEPTED partner_links row, and then only for
-- couples workout sessions plus the categories the owner has switched on.

-- ---------------------------------------------------------------- helpers
-- security definer so policies can consult partner_links / workout_sessions
-- without recursing into those tables' own policies.

create or replace function app.is_linked(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.partner_links l
    where l.status = 'accepted'
      and ((l.requester_id = auth.uid() and l.addressee_id = other)
        or (l.addressee_id = auth.uid() and l.requester_id = other))
  );
$$;

create or replace function app.shares_with_me(owner uuid, category text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.partner_links l
    where l.status = 'accepted'
      and ((l.requester_id = owner and l.addressee_id = auth.uid() and category = any (l.requester_shares))
        or (l.addressee_id = owner and l.requester_id = auth.uid() and category = any (l.addressee_shares)))
  );
$$;

create or replace function app.is_couples_session(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workout_sessions s where s.id = sid and s.is_couples);
$$;

-- ---------------------------------------------------------------- own rows
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'targets', 'programmes', 'day_logs', 'weight_logs', 'body_measurements',
    'sleep_logs', 'progress_photos', 'notification_preferences',
    'meal_entries', 'meal_items', 'saved_meals', 'ai_reports', 'coach_messages'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy own_select on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy own_insert on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy own_update on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy own_delete on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ------------------------------------------------- opt-in partner read access
-- Read-only, and only while the owner has that category switched on.
create policy partner_select on public.meal_entries      for select to authenticated using (app.shares_with_me(user_id, 'meals'));
create policy partner_select on public.meal_items        for select to authenticated using (app.shares_with_me(user_id, 'meals'));
create policy partner_select on public.weight_logs       for select to authenticated using (app.shares_with_me(user_id, 'weight'));
create policy partner_select on public.body_measurements for select to authenticated using (app.shares_with_me(user_id, 'measurements'));
create policy partner_select on public.progress_photos   for select to authenticated using (app.shares_with_me(user_id, 'photos'));
create policy partner_select on public.ai_reports        for select to authenticated using (app.shares_with_me(user_id, 'coach'));
create policy partner_select on public.coach_messages    for select to authenticated using (app.shares_with_me(user_id, 'coach'));

-- ---------------------------------------------------- shared reference data
-- Rows with user_id null are the shared library: readable by everyone signed
-- in, writable by nobody through the API. Users manage only their own rows.
do $$
declare t text;
begin
  foreach t in array array['food_items', 'exercises', 'workout_tracks', 'track_exercises'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy lib_select on public.%I for select to authenticated using (user_id is null or user_id = (select auth.uid()))', t);
    execute format('create policy own_update on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy own_delete on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
  foreach t in array array['food_items', 'exercises', 'workout_tracks'] loop
    execute format('create policy own_insert on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- A user may only add moves to a track they own.
create policy own_insert on public.track_exercises for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_tracks t where t.id = track_id and t.user_id = (select auth.uid()))
  );

-- ------------------------------------------------------- workout sessions
-- Own rows always. While linked, partners can read each other's COUPLES
-- sessions, and the phone owner can write the partner's copy of a couples
-- session (that is how one phone records the session to both accounts).
-- Solo sessions are never visible to a partner. Only the owner can delete.
alter table public.workout_sessions enable row level security;
create policy session_select on public.workout_sessions for select to authenticated
  using (user_id = (select auth.uid()) or (is_couples and app.is_linked(user_id)));
create policy session_insert on public.workout_sessions for insert to authenticated
  with check (user_id = (select auth.uid()) or (is_couples and app.is_linked(user_id)));
create policy session_update on public.workout_sessions for update to authenticated
  using (user_id = (select auth.uid()) or (is_couples and app.is_linked(user_id)))
  with check (user_id = (select auth.uid()) or (is_couples and app.is_linked(user_id)));
create policy session_delete on public.workout_sessions for delete to authenticated
  using (user_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['session_participants', 'exercise_sets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy session_select on public.%I for select to authenticated using (user_id = (select auth.uid()) or (app.is_linked(user_id) and app.is_couples_session(session_id)))', t);
    execute format('create policy session_insert on public.%I for insert to authenticated with check (user_id = (select auth.uid()) or (app.is_linked(user_id) and app.is_couples_session(session_id)))', t);
    execute format('create policy session_update on public.%I for update to authenticated using (user_id = (select auth.uid()) or (app.is_linked(user_id) and app.is_couples_session(session_id))) with check (user_id = (select auth.uid()) or (app.is_linked(user_id) and app.is_couples_session(session_id)))', t);
    execute format('create policy session_delete on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------- partner links
-- Readable by the two people on the link. No direct writes: every change goes
-- through the functions below, so nobody can accept on someone's behalf or
-- switch on sharing of the other person's data.
alter table public.partner_links enable row level security;
create policy link_select on public.partner_links for select to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

create or replace function public.create_partner_invite() returns public.partner_links
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); link public.partner_links;
begin
  if me is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  -- one open invite at a time: replace any earlier pending one
  update public.partner_links set status = 'revoked', revoked_at = now()
   where requester_id = me and status = 'pending';
  insert into public.partner_links (requester_id, invite_code)
  values (me, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)))
  returning * into link;
  return link;
end $$;

create or replace function public.accept_partner_invite(code text) returns public.partner_links
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); link public.partner_links;
begin
  if me is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select * into link from public.partner_links
   where invite_code = upper(trim(code)) and status = 'pending' for update;
  if not found or link.invite_expires_at < now() then
    raise exception 'This invite is not valid or has expired' using errcode = 'P0001';
  end if;
  if link.requester_id = me then
    raise exception 'You cannot accept your own invite' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.partner_links l where l.status = 'accepted'
              and (me in (l.requester_id, l.addressee_id)
                or link.requester_id in (l.requester_id, l.addressee_id))) then
    raise exception 'One of you already has a linked partner. Unlink first.' using errcode = 'P0001';
  end if;
  update public.partner_links
     set addressee_id = me, status = 'accepted', accepted_at = now()
   where id = link.id returning * into link;
  return link;
end $$;

-- Sets which categories of MY data my partner can read. Empty array = none.
create or replace function public.set_partner_sharing(link_id uuid, categories text[]) returns public.partner_links
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); link public.partner_links;
begin
  if me is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  update public.partner_links
     set requester_shares = case when requester_id = me then categories else requester_shares end,
         addressee_shares = case when addressee_id = me then categories else addressee_shares end
   where id = link_id and status = 'accepted' and me in (requester_id, addressee_id)
   returning * into link;
  if not found then raise exception 'No active link' using errcode = 'P0001'; end if;
  return link;
end $$;

-- Either person can unlink at any time. This stops all sharing in both directions.
create or replace function public.unlink_partner(link_id uuid) returns public.partner_links
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); link public.partner_links;
begin
  if me is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  update public.partner_links
     set status = 'revoked', revoked_at = now(), requester_shares = '{}', addressee_shares = '{}'
   where id = link_id and status in ('pending', 'accepted') and me in (requester_id, addressee_id)
   returning * into link;
  if not found then raise exception 'No active link' using errcode = 'P0001'; end if;
  return link;
end $$;

-- ------------------------------------------------------------- privileges
revoke all on all tables in schema public from anon, public;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.partner_links from authenticated;

grant usage on schema app to authenticated;
revoke all on all functions in schema app from public;
grant execute on function app.is_linked(uuid), app.shares_with_me(uuid, text), app.is_couples_session(uuid) to authenticated;

revoke all on function public.create_partner_invite(), public.accept_partner_invite(text),
  public.set_partner_sharing(uuid, text[]), public.unlink_partner(uuid) from public, anon;
grant execute on function public.create_partner_invite(), public.accept_partner_invite(text),
  public.set_partner_sharing(uuid, text[]), public.unlink_partner(uuid) to authenticated;

-- ------------------------------------------------ triggers and safety net
do $$
declare r record;
begin
  for r in
    select c.table_name from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'updated_at'
  loop
    execute format('create trigger touch_row before insert or update on public.%I for each row execute function app.touch_row()', r.table_name);
  end loop;

  -- Fail the migration if any table was left without row-level security.
  for r in
    select relname from pg_class
    where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity
  loop
    raise exception 'Table public.% has no row-level security', r.relname;
  end loop;
end $$;
