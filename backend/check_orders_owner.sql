-- CHECK ORDER OWNERSHIP
-- Run this to see who owns the existing orders.

SELECT 
  o.id, 
  o.numero_mesa, 
  o.created_at, 
  o.garzon_id, 
  p.nombre_completo as nombre_garzon,
  o.total
FROM public.orders o
LEFT JOIN public.profiles p ON o.garzon_id = p.id
ORDER BY o.created_at DESC
LIMIT 20;
