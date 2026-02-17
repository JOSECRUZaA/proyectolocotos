
-- DEBUG: Make 'products' bucket completely PUBLIC (Read/Write)
-- USE ONLY FOR DEBUGGING.

-- 1. Ensure Bucket Exists
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update set public = true;

-- 2. Drop all existing restrictive policies
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Authenticated Upload" on storage.objects;
drop policy if exists "Authenticated Update" on storage.objects;
drop policy if exists "Authenticated Delete" on storage.objects;
drop policy if exists "Public Read" on storage.objects;
drop policy if exists "Public Insert" on storage.objects;

-- 3. Create Permissive Policies (Allow everything to everyone for this bucket)
create policy "Public Read"
  on storage.objects for select
  using ( bucket_id = 'products' );

create policy "Public Insert"
  on storage.objects for insert
  with check ( bucket_id = 'products' ); -- Removed auth.role() check

create policy "Public Update"
  on storage.objects for update
  using ( bucket_id = 'products' );

create policy "Public Delete"
  on storage.objects for delete
  using ( bucket_id = 'products' );
