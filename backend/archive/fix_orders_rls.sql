-- FORCE ENABLE RLS ON ORDERS
-- Just in case the policy is missing or broken.

-- 1. Enable RLS
ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policy to be sure
DROP POLICY IF EXISTS "Staff Gestiona Ordenes" ON "public"."orders";
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON "public"."orders";

-- 3. Create permissive policy for authenticated staff
CREATE POLICY "Staff Gestiona Ordenes"
ON "public"."orders"
FOR ALL
USING (auth.role() = 'authenticated');

-- 4. Check if we have orders? (This will show in Supabase SQL Editor results)
SELECT count(*) as total_orders FROM "public"."orders";
