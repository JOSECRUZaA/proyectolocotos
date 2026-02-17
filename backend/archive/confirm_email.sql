-- CONFIRMAR USUARIOS PENDIENTES
-- Problema: Supabase requiere confirmación de correo por defecto.
-- Solución: Marcar manualmente el correo como confirmado.

-- 1. Confirmar al usuario específico (elias@locotos.com)
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'elias@locotos.com';

-- 2. O Confirmar TODOS los usuarios que estén pendientes
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;

-- NOTA: Para evitar esto en el futuro, ve a Authentication > Providers > Email en Supabase
-- y desactiva "Confirm email".
