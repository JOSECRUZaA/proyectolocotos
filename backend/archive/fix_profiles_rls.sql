-- PERMISOS PARA GESTIÓN DE USUARIOS
-- Problema: Los cambios en usuarios no se guardan porque faltan permisos de escritura (UPDATE).

-- 1. Permitir a los Administradores actualizar cualquier perfil
CREATE POLICY "Admin update profiles" 
ON public.profiles 
FOR UPDATE 
USING ( 
  (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'administrador' 
);

-- 2. Permitir INSERT (Crear usuarios) - Opcional si usas supabase.auth.signUp
-- Pero si insertas en profiles directamente:
CREATE POLICY "Admin insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK ( 
  (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'administrador' 
);

-- Instrucciones:
-- Copia y pega esto en el Editor SQL de Supabase para aplicar los cambios.
