-- Bulk Insert Products
-- Generated based on user list

INSERT INTO public.products (nombre, precio, area, descripcion, controla_stock, stock_actual, stock_diario_base, disponible) VALUES
-- Postres
('Copa Simple', 14.00, 'cocina', 'Postres', true, 20, 20, true),
('Copa Madidi', 18.00, 'cocina', 'Postres', true, 20, 20, true),
('Copa Amazónica', 24.00, 'cocina', 'Postres', true, 20, 20, true),

-- Platos Típicos y Especialidades
('Relleno Beniano', 20.00, 'cocina', 'Platos Típicos', true, 20, 20, true),
('Sopa de Maní', 20.00, 'cocina', 'Platos Típicos', true, 20, 20, true),
('Salchipapa para los peques', 35.00, 'cocina', 'Platos Típicos', true, 20, 20, true),
('Majadito', 45.00, 'cocina', 'Platos Típicos', true, 20, 20, true),
('Chicharrón de Cola de Lagarto', 68.00, 'cocina', 'Platos Típicos', true, 20, 20, true),
('Keperí al Horno', 68.00, 'cocina', 'Incluye ensaladas a elección', true, 20, 20, true),
('Pailita', 69.00, 'cocina', 'Platos Típicos', true, 20, 20, true),
('Chicharrón de Surubí', 75.00, 'cocina', 'Platos Típicos', true, 20, 20, true),
('Pique Macho', 94.00, 'cocina', 'Platos Típicos', true, 20, 20, true),
('Pique XL', 154.00, 'cocina', 'Platos Típicos', true, 20, 20, true),

-- Tablas (Para compartir)
('El Trifásico', 78.00, 'cocina', 'Tablas (Para compartir)', true, 20, 20, true),
('Tabla Keperí', 84.00, 'cocina', 'Tablas (Para compartir)', true, 20, 20, true),
('Tabla Charques', 84.00, 'cocina', 'Tablas (Para compartir)', true, 20, 20, true),
('Tabla Costillitas', 89.00, 'cocina', 'Tablas (Para compartir)', true, 20, 20, true),
('Tabla Dúo', 168.00, 'cocina', 'Tablas (Para compartir)', true, 20, 20, true),
('Tabla Locotitos', 186.00, 'cocina', 'Tablas (Para compartir)', true, 20, 20, true),
('Tabla Surtida', 286.00, 'cocina', 'Tablas (Para compartir)', true, 20, 20, true),

-- Especialidades de Cordero
('Brazuelo de Cordero', 104.00, 'cocina', 'Incluye caldito de cordero', true, 20, 20, true),
('Costillar de Cordero', 104.00, 'cocina', 'Incluye caldito de cordero', true, 20, 20, true),
('Cordero Entero', 178.00, 'cocina', 'Incluye caldito de cordero', true, 20, 20, true);
