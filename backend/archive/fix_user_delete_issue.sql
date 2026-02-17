-- SOLUCIÓN AL ERROR DE FOREIGN KEY EN DELETE USER

-- 1. Permitir que 'cajero_id' sea NULL en la tabla de sesiones de caja.
-- Esto es necesario para guardar el historial de la caja incluso si el usuario se elimina.
ALTER TABLE public.cash_sessions ALTER COLUMN cajero_id DROP NOT NULL;

-- 2. Actualizar la función de borrado para poner NULL en lugar de un ID falso.
CREATE OR REPLACE FUNCTION public.delete_user_completely(target_user_id UUID)
RETURNS void AS $$
BEGIN
  -- A. DESVINCULAR VENTAS (Poner en NULL para no perder el registro de venta)
  UPDATE public.orders 
  SET garzon_id = NULL 
  WHERE garzon_id::text = target_user_id::text;

  UPDATE public.orders 
  SET cajero_id = NULL 
  WHERE cajero_id::text = target_user_id::text;

  -- B. DESVINCULAR SESIONES DE CAJA
  UPDATE public.cash_sessions
  SET cajero_id = NULL  -- Esto ahora funcionará gracias al ALTER TABLE de arriba
  WHERE cajero_id::text = target_user_id::text;

  -- C. BORRAR PERFIL (Si existe trigger de cascade, esto borrará auth.users tambien)
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- D. BORRAR DE AUTH.USERS (Por si acaso el trigger no existe o falla)
  -- Nota: Si auth.users tiene FK hacia storage u otras tablas, might fail, but usually fine.
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Instrucciones:
-- Ejecuta todo este script en el Editor SQL de Supabase.
-- Luego intenta eliminar el usuario nuevamente desde la app.
