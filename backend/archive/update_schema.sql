-- Add daily stock limit and priority columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS stock_diario_base INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS prioridad BOOLEAN DEFAULT FALSE;

-- Function to reset daily stock
CREATE OR REPLACE FUNCTION reset_daily_stock()
RETURNS void AS $$
BEGIN
  UPDATE products
  SET stock_actual = stock_diario_base,
      disponible = TRUE
  WHERE stock_diario_base > 0;
END;
$$ LANGUAGE plpgsql;
