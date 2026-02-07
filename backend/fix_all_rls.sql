-- FIX ALL RLS POLICIES
-- Ensure Waiters can READ everything needed for the Orders page.

-- 1. ORDERS
ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff Read Orders" ON "public"."orders";
CREATE POLICY "Staff Read Orders" ON "public"."orders" FOR SELECT
USING (auth.role() = 'authenticated');

-- 2. ORDER ITEMS
ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff Read Order Items" ON "public"."order_items";
CREATE POLICY "Staff Read Order Items" ON "public"."order_items" FOR SELECT
USING (auth.role() = 'authenticated');

-- 3. MESAS
ALTER TABLE "public"."mesas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff Read Mesas" ON "public"."mesas";
CREATE POLICY "Staff Read Mesas" ON "public"."mesas" FOR SELECT
USING (auth.role() = 'authenticated');

-- 4. PRODUCTS (Just in case)
ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff Read Products" ON "public"."products";
CREATE POLICY "Staff Read Products" ON "public"."products" FOR SELECT
USING (auth.role() = 'authenticated');
