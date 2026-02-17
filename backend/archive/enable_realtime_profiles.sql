-- Enable Realtime for the profiles table
-- 1. Ensure the table is in the publication
BEGIN;

-- Check if publication exists (Supabase default is 'supabase_realtime')
-- If not, we can't do much but usually it exists.
-- We explicitly add the table to the publication.

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- 2. Set Replica Identity to allow proper update tracking (optional but good practice)
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

COMMIT;
