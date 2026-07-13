-- Atribui as capas customizadas (cyberpunk neon "AULA #1") aos modulos da trilha.
-- Imagens sao servidas pelo Netlify a partir de /public/trilhas/*.png

UPDATE public.member_modules
SET thumbnail_url = '/trilhas/boas-vindas.png'
WHERE title ILIKE '%bem vindo%' OR title ILIKE '%boas vindas%';

UPDATE public.member_modules
SET thumbnail_url = '/trilhas/automacao-com-ia.png'
WHERE title ILIKE '%automacao%' OR title ILIKE '%automação%';

UPDATE public.member_modules
SET thumbnail_url = '/trilhas/construindo-crm.png'
WHERE title ILIKE '%construindo%' AND title ILIKE '%crm%';

UPDATE public.member_modules
SET thumbnail_url = '/trilhas/nova-era-claude.png'
WHERE title ILIKE '%nova era%' AND title ILIKE '%claude%';
