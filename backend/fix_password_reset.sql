-- 1. Enable pgcrypto extension explicitly in public schema
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;

-- 2. Drop the function to ensure a clean slate
DROP FUNCTION IF EXISTS public.admin_reset_password(uuid, text);

-- 3. Recreate the function with robust search_path and explicit schema qualifiers
CREATE OR REPLACE FUNCTION public.admin_reset_password(
  target_user_id uuid,
  new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions -- Ensure it can find the tables and functions
AS $$
BEGIN
  -- Verify Admin permissions
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rol = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: Solo los administradores pueden reiniciar contraseñas.';
  END IF;

  -- Update password using public.crypt and public.gen_salt
  UPDATE auth.users
  SET encrypted_password = public.crypt(new_password, public.gen_salt('bf'))
  WHERE id = target_user_id;

  -- Validation
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado.';
  END IF;
END;
$$;
