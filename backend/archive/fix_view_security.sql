-- Recreamos la vista agregando "WITH (security_invoker = true)"
-- Esto elimina el aviso de seguridad (TAG ROJO) de Supabase y asegura que se respeten los permisos de usuario.

CREATE OR REPLACE VIEW public.reporte_cierre_diario
WITH (security_invoker = true) -- <--- ESTA LÍNEA SOLUCIONA LA ADVERTENCIA DE SEGURIDAD
AS
SELECT 
  p.nombre AS producto,
  p.area,
  SUM(oi.cantidad) AS cantidad_vendida,
  SUM(oi.subtotal) AS total_dinero,
  p.stock_actual
FROM public.order_items oi
JOIN public.orders o ON oi.order_id = o.id
JOIN public.products p ON oi.product_id = p.id
WHERE o.estado = 'pagado' 
AND DATE(o.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz') = DATE(NOW() AT TIME ZONE 'America/La_Paz')
GROUP BY p.id, p.nombre, p.area, p.stock_actual;
