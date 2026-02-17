-- PERMISOS DEFINITIVOS PARA ADMINISTRADORES
-- El error "new row violates row-level security policy" indica que Supabase
-- está bloqueando la actualización porque la política actual es muy restrictiva.

-- 1. Primero, limpiamos políticas viejas que puedan estar causando conflicto
DROP POLICY IF EXISTS "Admin update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.profiles;

-- 2. Política Maestra para Administradores (Hacer TODO: Ver, Editar, Borrar)
CREATE POLICY "Admin All Access"
ON public.profiles
FOR ALL
USING (
  (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'administrador'
)
WITH CHECK (
  (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'administrador'
);

-- 3. Política de Mínimos para el Resto (Solo Leer)
CREATE POLICY "Public Read Access"
ON public.profiles
FOR SELECT
USING (true);

-- 4. Política de Auto-Edición (Cada usuario puede editar sus propios datos básicos)
CREATE POLICY "Self Update"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Instrucciones:
-- Copia todo este código y ejecútalo en el SQL Editor de Supabase.
-- Esto reemplazará las reglas anteriores con una configuración más limpia y permisiva para el Admin.
