-- Planos da tabela do Pedro: Business passa a ser um plano próprio.
ALTER TYPE "Plano" ADD VALUE IF NOT EXISTS 'BUSINESS' BEFORE 'ENTERPRISE';
-- (o ADD VALUE tem de ficar confirmado antes de se usar o valor novo)
