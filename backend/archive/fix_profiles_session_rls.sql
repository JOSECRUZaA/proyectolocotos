-- Ensure users can update their own profile, specifically the current_session_id
DO $$
BEGIN
    -- Drop existing update policy if it exists to recreate it correctly
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    
    -- Create policy allowing users to update their own profile
    CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

    -- Ensure SELECT is allowed for authenticated users (needed for login check)
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
    CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles
    FOR SELECT
    USING (true); -- Or limit to authenticated users if stricter privacy needed

END $$;
