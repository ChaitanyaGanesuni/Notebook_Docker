-- Private photo buckets. Objects live under "<user id>/..." and are read
-- through signed URLs only; nothing here is public.
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false), ('progress-photos', 'progress-photos', false)
on conflict (id) do update set public = false;

-- Compares the folder as text so a malformed object name can never raise.
create or replace function app.folder_shares_with_me(owner_folder text, category text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.partner_links l
    where l.status = 'accepted'
      and ((l.requester_id::text = owner_folder and l.addressee_id = auth.uid() and category = any (l.requester_shares))
        or (l.addressee_id::text = owner_folder and l.requester_id = auth.uid() and category = any (l.addressee_shares)))
  );
$$;
revoke all on function app.folder_shares_with_me(text, text) from public;
grant execute on function app.folder_shares_with_me(text, text) to authenticated;

create policy photos_own_select on storage.objects for select to authenticated
  using (bucket_id in ('meal-photos', 'progress-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy photos_own_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('meal-photos', 'progress-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy photos_own_update on storage.objects for update to authenticated
  using (bucket_id in ('meal-photos', 'progress-photos') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('meal-photos', 'progress-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy photos_own_delete on storage.objects for delete to authenticated
  using (bucket_id in ('meal-photos', 'progress-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Partner read access, only while the owner shares that category.
create policy photos_partner_select on storage.objects for select to authenticated
  using (
    (bucket_id = 'meal-photos' and app.folder_shares_with_me((storage.foldername(name))[1], 'meals'))
    or (bucket_id = 'progress-photos' and app.folder_shares_with_me((storage.foldername(name))[1], 'photos'))
  );
