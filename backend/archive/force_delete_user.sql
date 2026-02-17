-- ELIMINACIÓN SEGURA DEFINITIVA (Preservando Ventas)
-- Este script permite borrar un usuario de Authentication SIN perder el dinero de sus ventas.

-- 1. Crear función para borrar usuario preservando historial
CREATE OR REPLACE FUNCTION public.delete_user_completely(target_user_id UUID)
RETURNS void AS $$
BEGIN
  -- A. DESVINCULAR VENTAS (Para que no se borren)
  -- Ponemos el ID del mesero/cajero en NULL, pero el monto y la orden quedan.
  UPDATE public.orders 
  SET garzon_id = NULL 
  WHERE garzon_id::text = target_user_id::text;

  UPDATE public.orders 
  SET cajero_id = NULL 
  WHERE cajero_id::text = target_user_id::text;

  UPDATE public.cash_sessions
  SET cajero_id = '00000000-0000-0000-0000-000000000000' -- Asignar a usuario fantasma o NULL si la tabla lo permite
  WHERE cajero_id::text = target_user_id::text;

  -- B. BORRAR PERFIL (Si existe trigger de cascade, esto borrará auth.users tambien)
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- C. BORRAR DE AUTH.USERS (Por si acaso el trigger no existe)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Instrucciones de Uso:
-- Para borrar a un usuario específico, usa su ID en el editor SQL:
-- SELECT public.delete_user_completely('ID-DEL-USUARIO-AQUI');
