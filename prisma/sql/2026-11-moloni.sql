-- Faturas certificadas pela Moloni. Pode correr-se mais de uma vez.
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "moloni_orcamento_id" INTEGER;
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "moloni_orcamento" TEXT;
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "moloni_orcamento_pdf" TEXT;
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "moloni_fatura_id" INTEGER;
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "moloni_fatura" TEXT;
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "moloni_fatura_pdf" TEXT;
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "moloni_erro" TEXT;
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "moloni_tentativas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "codigo_postal" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "cidade" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "moloni_cliente_id" INTEGER;
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "cp_cliente" TEXT;
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "cidade_cliente" TEXT;
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "fatura_enviada_em" TIMESTAMP(3);
