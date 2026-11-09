-- Cobranças: comprovativos, avisos, suspensão por falta de pagamento e
-- pacotes à medida de uma empresa. Aplicado à mão; pode correr-se mais de uma vez.

ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "em_falta_desde" TIMESTAMP(3);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "suspensa_pagamento" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "aviso_renovacao" TIMESTAMP(3);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "nif" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "morada" TEXT;

ALTER TABLE "pacotes" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
DO $$ BEGIN
  ALTER TABLE "pacotes" ADD CONSTRAINT "pacotes_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "numero" TEXT;
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "nome_cliente" TEXT;
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "nif_cliente" TEXT;
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "morada_cliente" TEXT;
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "pago_em" TIMESTAMP(3);
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "email_enviado_em" TIMESTAMP(3);
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "aviso_falha_em" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "pagamentos_numero_key" ON "pagamentos"("numero");
