-- ==============================================================================
-- SCRIPT DE REINICIO DE BASE DE DATOS (PARA ENTREGA FINAL)
-- ==============================================================================
-- ADVERTENCIA: Este script ELIMINARÁ todo el historial de ventas, pedidos y sesiones de caja.
-- MANTENDRÁ: Usuarios (Perfiles), Productos y configuración de Mesas.
-- ==============================================================================

BEGIN;

-- 1. Liberar todas las mesas para quitar referencias a ordenes
UPDATE public.mesas 
SET estado = 'libre', 
    orden_actual_id = NULL;

-- 2. Eliminar datos transaccionales y reiniciar contadores (IDs)
-- TRUNCATE elimina registros rápidamente.
-- RESTART IDENTITY reinicia las secuencias (IDs autoincrementales) a 1.
-- CASCADE asegura que se borren tablas dependientes (ej. order_items depende de orders).

TRUNCATE TABLE 
    public.order_items,
    public.orders, 
    public.cash_sessions
RESTART IDENTITY CASCADE;

-- 3. (Opcional) Si usas una secuencia manual para el número de orden diario, reiníciala aquí.
-- Si daily_order_number es una columna IDENTITY, el comando de arriba ya lo hizo.
-- Si usaste una secuencia llamada 'daily_order_number_seq' (ejemplo), descomenta:
-- ALTER SEQUENCE IF EXISTS daily_order_number_seq RESTART WITH 1;

COMMIT;

-- Verificación final
SELECT 'Base de datos reiniciada correctamente. Ventas y sesiones eliminadas. Productos y Usuarios conservados.' as mensaje;
