-- Helpers shared by every table.
create schema if not exists app;

-- Offline-first sync is last-write-wins per row on updated_at, which the client
-- sets when the change is made (possibly hours before it syncs).
--   insert: fill created_at / updated_at when missing
--   update: skip the write when the incoming row is older than the stored one;
--           created_at never changes; future-dated clocks are clamped to now
create or replace function app.touch_row() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := least(coalesce(new.updated_at, now()), now() + interval '5 minutes');
    return new;
  end if;
  new.created_at := old.created_at;
  if new.updated_at is null or new.updated_at = old.updated_at then
    new.updated_at := now();           -- server-side edit that did not set it
  elsif new.updated_at < old.updated_at then
    return null;                        -- stale offline write: keep the newer row
  end if;
  new.updated_at := least(new.updated_at, now() + interval '5 minutes');
  return new;
end $$;
