-- Enable pgcrypto for password hashing
create extension if not exists pgcrypto;

-- Create a stored procedure to reset user password
-- This function mimics Supabase's encryption (bcrypt) to update the auth.users table directly
-- SECURITY DEFINER allows it to run with elevated privileges (needed to touch auth.users)

create or replace function public.admin_reset_password(
  target_user_id uuid,
  new_password text
)
returns void
language plpgsql
security definer
as $$
begin
  -- Check if the executor is an admin (optional but recommended)
  -- For now we assume the RLS on the frontend button handles visibility, 
  -- but strictly we should check:
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = 'administrador'
  ) then
    raise exception 'Solo los administradores pueden reiniciar contraseñas';
  end if;

  -- Update the password in auth.users
  -- NOTE: Supabase uses bcrypt. We need pgcrypto extension.
  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf'))
  where id = target_user_id;

  -- Verify update
  if not found then
    raise exception 'Usuario no encontrado';
  end if;
end;
$$;
