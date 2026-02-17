-- Add current_session_id to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND column_name = 'current_session_id'
    ) THEN
        ALTER TABLE public.profiles
        ADD COLUMN current_session_id TEXT;
    END IF;
END $$;
