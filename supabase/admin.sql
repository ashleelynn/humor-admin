-- The admin area: superadmins can see everything and manage photo booth drops.
-- Run once in the Supabase SQL Editor, after the main app's schema.sql, profiles.sql and photo-booth.sql.
--
-- The database enforces every admin permission, not just the app. Even with the admin app's code
-- in hand, a normal user's session gets nothing extra.

-- 1. The flag. Users can already update only first_name, last_name, avatar_url and updated_at,
--    so nobody can promote themselves through the API. Only the database owner can set it.
alter table public.profiles add column if not exists is_superadmin boolean not null default false;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_superadmin from public.profiles p where p.id = (select auth.uid())), false);
$$;

revoke execute on function public.is_superadmin() from public, anon;
grant execute on function public.is_superadmin() to authenticated;

-- 2. Read access. These policies add to the existing ones; normal users are unaffected.
create policy "Superadmins see every profile"
  on public.profiles for select to authenticated
  using ((select public.is_superadmin()));

create policy "Superadmins see every vote"
  on public.caption_votes for select to authenticated
  using ((select public.is_superadmin()));

-- generations keeps user_id, context and prompt column-locked for everyone, so admins read
-- the full rows through this function instead.
create or replace function public.admin_generations()
returns table (
  id bigint,
  created_at timestamptz,
  user_id uuid,
  image_path text,
  theme text,
  alt_text text,
  context text,
  model text,
  prompt text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Superadmins only' using errcode = '42501';
  end if;
  return query
    select g.id, g.created_at, g.user_id, g.image_path, g.theme, g.alt_text, g.context, g.model, g.prompt
    from public.generations g
    order by g.created_at desc;
end;
$$;

-- Everyone who has signed up, with their email and how much they've done. Emails live in
-- auth.users, which the API can't reach, so this is the only way the admin app sees them.
create or replace function public.admin_users()
returns table (
  id uuid,
  email text,
  provider text,
  first_name text,
  last_name text,
  avatar_url text,
  is_superadmin boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  confessions int,
  drops int,
  votes int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Superadmins only' using errcode = '42501';
  end if;
  return query
    select
      u.id,
      u.email::text,
      coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
      p.first_name,
      p.last_name,
      p.avatar_url,
      coalesce(p.is_superadmin, false),
      u.created_at,
      u.last_sign_in_at,
      (select count(*)::int from public.confessions c where c.user_id = u.id),
      (select count(*)::int from public.generations g where g.user_id = u.id),
      (select count(*)::int from public.caption_votes v where v.user_id = u.id)
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end;
$$;

revoke execute on function public.admin_generations() from public, anon;
revoke execute on function public.admin_users() from public, anon;
grant execute on function public.admin_generations() to authenticated;
grant execute on function public.admin_users() to authenticated;

-- 3. Managing AI generated media. The grants open the columns; only these superadmin
--    policies let a row through, so normal users still can't edit or delete anything.
grant update (theme, alt_text) on public.generations to authenticated;
grant delete on public.generations to authenticated;
grant update (mood, body) on public.captions to authenticated;
grant delete on public.captions to authenticated;

create policy "Superadmins drop without the daily limit"
  on public.generations for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_superadmin()));

create policy "Superadmins edit drops"
  on public.generations for update to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

create policy "Superadmins delete drops"
  on public.generations for delete to authenticated
  using ((select public.is_superadmin()));

create policy "Superadmins add captions"
  on public.captions for insert to authenticated
  with check ((select public.is_superadmin()));

create policy "Superadmins edit captions"
  on public.captions for update to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

create policy "Superadmins delete captions"
  on public.captions for delete to authenticated
  using ((select public.is_superadmin()));

-- Photo files: superadmins can upload without the daily limit and delete them.
create policy "Superadmins see booth photo files"
  on storage.objects for select to authenticated
  using (bucket_id = 'booth-photos' and (select public.is_superadmin()));

create policy "Superadmins upload booth photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'booth-photos'
    and name ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$'
    and (select public.is_superadmin())
  );

create policy "Superadmins delete booth photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'booth-photos' and (select public.is_superadmin()));

-- 4. The first superadmin. The flag can't be set through the API, so whoever owns the
--    Supabase project sets it here, where SQL runs as the database owner and RLS doesn't apply:
--
-- update public.profiles set is_superadmin = true
-- where id = (select id from auth.users where email = 'you@example.com');
