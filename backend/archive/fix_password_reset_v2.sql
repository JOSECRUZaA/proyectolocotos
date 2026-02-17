-- 1. Ensure pgcrypto is installed in the 'extensions' schema (standard for Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- 2. Drop the function to update it
DROP FUNCTION IF EXISTS public.admin_reset_password(uuid, text);

-- 3. Recreate the function with 'extensions' in the search_path
CREATE OR REPLACE FUNCTION public.admin_reset_password(
  target_user_id uuid,
  new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
-- IMPORTANT: Add 'extensions' to search_path so it finds gen_salt and crypt
SET search_path = extensions, public, auth
AS $$
BEGIN
  -- Verify Admin permissions
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rol = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: Solo los administradores pueden reiniciar contraseñas.';
  END IF;

  -- Update password using crypt and gen_salt (found via search_path)
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;

  -- Validation
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado.';
  END IF;
END;
$$;
