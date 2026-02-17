-- SOLUCIÓN AL PROBLEMA DE PERMISOS (RLS)
-- Los garzones no podían ver si la caja estaba abierta porque las políticas de seguridad
-- solo permitían ver la tabla cash_sessions al cajero dueño de la sesión o al admin.

-- Ejecuta esto en el Editor SQL de Supabase:

CREATE POLICY "Staff puede ver estado de cajas" 
ON public.cash_sessions 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Esto permitirá que el "Mapa de Mesas" pueda consultar si hay alguna caja abierta.
