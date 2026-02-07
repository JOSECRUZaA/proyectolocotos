-- FIX: Allow Waiting Staff to Update Tables
-- Previously, only administrators could UPDATE mesas. 
-- This prevented Waiters from changing table status to 'ocupada', causing orders to be hidden.

-- 1. Drop the restrictive policy if it exists (or we can just add a new permissive one, but better to replace)
DROP POLICY IF EXISTS "Enable update for administrators" ON "public"."mesas";

-- 2. Create a new policy allowing ALL authenticated staff to update mesas
-- (Needed for changing status to 'ocupada', 'pidio_cuenta', 'libre')
CREATE POLICY "Staff Update Tables"
ON "public"."mesas"
FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- 3. Also ensure SELECT is enabled (redundant check but safe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Enable read access for all authenticated users' AND tablename = 'mesas'
    ) THEN
        CREATE POLICY "Enable read access for all authenticated users"
        ON "public"."mesas" FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
END
$$;
