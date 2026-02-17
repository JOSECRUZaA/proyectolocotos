-- SOLUCIÓN DEFINITIVA PARA ERROR DE FOREIGN KEY
-- Este script modifica la relación entre 'cash_sessions' y 'profiles'/'users'
-- para que cuando se borre un usuario, el campo cajero_id se ponga en NULL automáticamente.

-- 1. Eliminar la restricción actual (que bloquea el borrado)
ALTER TABLE public.cash_sessions 
DROP CONSTRAINT IF EXISTS cash_sessions_cajero_id_fkey;

-- 2. Volver a crear la restricción con la regla "ON DELETE SET NULL"
-- Esto significa: "Si borro al usuario, pon el campo cajero_id en NULL (vacío), pero NO borres la sesión de caja".
ALTER TABLE public.cash_sessions
ADD CONSTRAINT cash_sessions_cajero_id_fkey
FOREIGN KEY (cajero_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;

-- 3. (Opcional) Asegurar también que orders tenga el mismo comportamiento si no lo tiene
ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_garzon_id_fkey;

ALTER TABLE public.orders
ADD CONSTRAINT orders_garzon_id_fkey
FOREIGN KEY (garzon_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_cajero_id_fkey;

ALTER TABLE public.orders
ADD CONSTRAINT orders_cajero_id_fkey
FOREIGN KEY (cajero_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;

-- Instrucción: Ejecuta esto en el Editor SQL de Supabase.
-- Luego podrás eliminar usuarios sin problemas.
