
-- 1. Create a public bucket for products
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do nothing;

-- 2. Enable RLS
alter table storage.objects enable row level security;

-- 3. Policy: Public Read Access (Everyone can view images)
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'products' );

-- 4. Policy: Authenticated Upload (Only logged in users can upload)
create policy "Authenticated Upload"
  on storage.objects for insert
  with check ( bucket_id = 'products' and auth.role() = 'authenticated' );

-- 5. Policy: Authenticated Update/Delete
create policy "Authenticated Update"
  on storage.objects for update
  using ( bucket_id = 'products' and auth.role() = 'authenticated' );

create policy "Authenticated Delete"
  on storage.objects for delete
  using ( bucket_id = 'products' and auth.role() = 'authenticated' );
