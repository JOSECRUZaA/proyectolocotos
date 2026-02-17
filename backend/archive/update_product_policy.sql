-- Allow Cashiers to UPDATE products (specifically for Priority flag)
CREATE POLICY "Cajero Actualiza Productos"
ON public.products
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'cajero')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'cajero')
);
