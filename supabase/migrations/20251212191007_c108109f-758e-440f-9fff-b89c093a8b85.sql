-- Adicionar política para permitir DELETE de clientes (para admin)
CREATE POLICY "Allow public delete clients" 
ON public.clients 
FOR DELETE 
USING (true);

-- Adicionar política para DELETE nas tabelas relacionadas
CREATE POLICY "Allow public delete client_audience" ON public.client_audience FOR DELETE USING (true);
CREATE POLICY "Allow public delete client_branding" ON public.client_branding FOR DELETE USING (true);
CREATE POLICY "Allow public delete client_expansion" ON public.client_expansion FOR DELETE USING (true);
CREATE POLICY "Allow public delete client_goals" ON public.client_goals FOR DELETE USING (true);
CREATE POLICY "Allow public delete client_materials" ON public.client_materials FOR DELETE USING (true);
CREATE POLICY "Allow public delete client_operations" ON public.client_operations FOR DELETE USING (true);
CREATE POLICY "Allow public delete client_policies" ON public.client_policies FOR DELETE USING (true);
CREATE POLICY "Allow public delete client_products" ON public.client_products FOR DELETE USING (true);
CREATE POLICY "Allow public delete client_technical" ON public.client_technical FOR DELETE USING (true);