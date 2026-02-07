-- POLICY: Enable SELECT for authenticated users on 'mesas'
-- RLS was enabled on 'mesas', but without a SELECT policy, regular users (waiters) cannot READ the tables.
-- This causes queries joining 'mesas' (like WaiterOrders) to return empty results.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'mesas'
        AND policyname = 'Enable read access for all authenticated users'
    ) THEN
        CREATE POLICY "Enable read access for all authenticated users"
        ON "public"."mesas"
        FOR SELECT
        USING (auth.role() = 'authenticated');
    END IF;
END
$$;
