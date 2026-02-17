-- SINCRONIZACIÓN DE ELIMINACIÓN (Cascade Delete)
-- Problema: Al borrar un usuario desde la App, se borra el perfil pero el "Login" sigue activo en Supabase.
-- Solución: Crear un "Trigger" (Gatillo) que borre automáticamente el Login cuando se borra el perfil.

-- 1. Función para borrar de auth.users (Requiere permisos especiales SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.delete_user_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Borra el usuario de la tabla de autenticación
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear el Trigger en la tabla profiles
DROP TRIGGER IF EXISTS on_profile_deleted ON public.profiles;

CREATE TRIGGER on_profile_deleted
AFTER DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.delete_user_from_auth();

-- Instrucciones:
-- 1. Copia y pega este código en el Editor SQL de Supabase.
-- 2. Ejecútalo.
-- 3. A partir de ahora, cuando borres a alguien en la App, ¡desaparecerá también de la lista de Authentication!
