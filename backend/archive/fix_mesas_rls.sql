-- POLICY: Enable insert for authenticated users with role 'administrador'
-- This fixes the error "new row violates row-level security policy for table mesas"

-- 1. Enable RLS on the table (just in case it wasn't enabled, though the error suggests it is)
ALTER TABLE "public"."mesas" ENABLE ROW LEVEL SECURITY;

-- 2. Create the policy for INSERT
-- We use DO block to avoid error if policy already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'mesas'
        AND policyname = 'Enable insert for administrators'
    ) THEN
        CREATE POLICY "Enable insert for administrators"
        ON "public"."mesas"
        FOR INSERT
        WITH CHECK (
            auth.uid() IN (
                SELECT id FROM profiles WHERE rol = 'administrador'
            )
        );
    END IF;
END
$$;

-- 3. Also ensure admins can DELETE tables (since there is a delete button)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'mesas'
        AND policyname = 'Enable delete for administrators'
    ) THEN
        CREATE POLICY "Enable delete for administrators"
        ON "public"."mesas"
        FOR DELETE
        USING (
            auth.uid() IN (
                SELECT id FROM profiles WHERE rol = 'administrador'
            )
        );
    END IF;
END
$$;

-- 4. Ensure admins can UPDATE tables (e.g. changing state or capacity)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'mesas'
        AND policyname = 'Enable update for administrators'
    ) THEN
        CREATE POLICY "Enable update for administrators"
        ON "public"."mesas"
        FOR UPDATE
        USING (
            auth.uid() IN (
                SELECT id FROM profiles WHERE rol = 'administrador'
            )
        )
        WITH CHECK (
            auth.uid() IN (
                SELECT id FROM profiles WHERE rol = 'administrador'
            )
        );
    END IF;
END
$$;
