-- O programa dos membros era a string 'metodo-squaad', com esse valor chumbado
-- no default da coluna e em 17 pontos do frontend, enquanto a interface exibia
-- "Método + que Vencedores". A tabela members está vazia (0 linhas), então não
-- há dado pra migrar — só o default e o código.
ALTER TABLE public.members ALTER COLUMN program SET DEFAULT 'metodo-vencedores';

-- Rede de segurança: se alguma linha aparecer entre este levantamento e o deploy,
-- ela vai junto em vez de ficar órfã de um programa que o frontend não conhece.
UPDATE public.members SET program = 'metodo-vencedores' WHERE program = 'metodo-squaad';
