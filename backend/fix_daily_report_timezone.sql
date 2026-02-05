-- Reemplazar la vista 'reporte_cierre_diario' para usar la Zona Horaria de Bolivia (GMT-4)
-- Esto asegura que las ventas "del día" sean correctas según la hora local, no UTC.

CREATE OR REPLACE VIEW public.reporte_cierre_diario AS
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
-- COMPARACIÓN CORREGIDA CON TIMEZONE:
-- Convertimos 'created_at' (que está en UTC) a 'America/La_Paz'
-- Convertimos 'NOW()' (que es UTC) a 'America/La_Paz'
AND DATE(o.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz') = DATE(NOW() AT TIME ZONE 'America/La_Paz')
GROUP BY p.id, p.nombre, p.area, p.stock_actual;
