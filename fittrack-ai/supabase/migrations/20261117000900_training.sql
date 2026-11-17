-- Training: difficulty levels, partner display names.

-- The user's chosen difficulty level for a move (index into the move's ladder, easiest = 0).
alter table public.track_exercises add column level int not null default 0 check (level between 0 and 10);
-- The level a set was done at, so progression can be judged per level.
alter table public.exercise_sets add column level int check (level between 0 and 10);

-- A linked partner sees only the other's display name, nothing else from the profile.
alter table public.partner_links
  add column requester_name text check (char_length(requester_name) <= 60),
  add column addressee_name text check (char_length(addressee_name) <= 60);

create or replace function public.create_partner_invite() returns public.partner_links
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); link public.partner_links;
begin
  if me is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  update public.partner_links set status = 'revoked', revoked_at = now()
   where requester_id = me and status = 'pending';
  insert into public.partner_links (requester_id, invite_code, requester_name)
  values (me, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
          (select p.display_name from public.profiles p where p.user_id = me))
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
     set addressee_id = me, status = 'accepted', accepted_at = now(),
         addressee_name = (select p.display_name from public.profiles p where p.user_id = me)
   where id = link.id returning * into link;
  return link;
end $$;
