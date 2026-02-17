-- 1. Add the column
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS daily_order_number INTEGER;

-- 2. Create the function to calculate the number
CREATE OR REPLACE FUNCTION public.assign_daily_order_number()
RETURNS TRIGGER AS $$
DECLARE
    next_number INTEGER;
BEGIN
    -- Calculate the next number for TODAY
    SELECT COALESCE(MAX(daily_order_number), 0) + 1
    INTO next_number
    FROM public.orders
    WHERE created_at >= CURRENT_DATE
    AND created_at < CURRENT_DATE + INTERVAL '1 day';

    -- Assign it to the new row
    NEW.daily_order_number := next_number;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trigger_assign_daily_order_number ON public.orders;

CREATE TRIGGER trigger_assign_daily_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.assign_daily_order_number();
