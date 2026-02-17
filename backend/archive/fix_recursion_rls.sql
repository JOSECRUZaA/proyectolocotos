-- SOLUCIÓN FINAL ERROR 500 (Recursión Infinita)
-- El error de "Pantalla Blanca" y status 500 se debe a que la política anterior
-- intentaba leer la tabla 'profiles' para ver si eras admin, pero leer 'profiles'
-- requería ejecutar la política... creando un bucle infinito.

-- 1. Función Segura para verificar Admin (Bypassea RLS para evitar el bucle)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rol = 'administrador'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- SECURITY DEFINER es la clave aquí

-- 2. Limpieza Total de Políticas
DROP POLICY IF EXISTS "Admin All Access" ON public.profiles;
DROP POLICY IF EXISTS "Public Read Access" ON public.profiles;
DROP POLICY IF EXISTS "Self Update" ON public.profiles;
DROP POLICY IF EXISTS "Admin update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.profiles;

-- 3. Política SIMPLE de Lectura (Todo el mundo puede ver nombres/roles)
CREATE POLICY "Lectura General"
ON public.profiles
FOR SELECT
USING (true);

-- 4. Política de Administración Total (Usando la función segura)
CREATE POLICY "Admin Total"
ON public.profiles
FOR ALL 
USING ( public.is_admin() )
WITH CHECK ( public.is_admin() );

-- 5. Política de Edición Propia (Para que cada uno pueda editar su perfil si no es admin)
-- Nota: Admin Total ya cubre al admin, esto es para el resto.
CREATE POLICY "Edicion Propia"
ON public.profiles
FOR UPDATE
USING ( auth.uid() = id );

-- INSTRUCCIONES:
-- Ejecuta este script. Esto solucionará el Error 500 y la pantalla blanca inmediatamente.
