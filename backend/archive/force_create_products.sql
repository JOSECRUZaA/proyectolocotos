
-- Force Create Storage Bucket "products"

-- 1. Create Bucket (if not exists)
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do nothing;

-- 2. Enable RLS
alter table storage.objects enable row level security;

-- 3. Create Policies (Drop first to ensure clean state)
drop policy if exists "Public Access" on storage.objects;
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'products' );

drop policy if exists "Authenticated Upload" on storage.objects;
create policy "Authenticated Upload"
  on storage.objects for insert
  with check ( bucket_id = 'products' and auth.role() = 'authenticated' );

drop policy if exists "Authenticated Update" on storage.objects;
create policy "Authenticated Update"
  on storage.objects for update
  using ( bucket_id = 'products' and auth.role() = 'authenticated' );

drop policy if exists "Authenticated Delete" on storage.objects;
create policy "Authenticated Delete"
  on storage.objects for delete
  using ( bucket_id = 'products' and auth.role() = 'authenticated' );

-- 4. Verify (Optional output)
select id, name, public, created_at from storage.buckets where id = 'products';
