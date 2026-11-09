-- Pagamentos com Stripe: pacotes, pagamentos, configuração e a subscrição de
-- cada empresa. Aplicado à mão (o histórico de migrações do Prisma está
-- dessincronizado com a base). Pode correr-se mais do que uma vez.

ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'PAGAMENTO';

CREATE TABLE IF NOT EXISTS "pacotes" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "descricao" TEXT,
  "preco_centimos" INTEGER NOT NULL,
  "moeda" TEXT NOT NULL DEFAULT 'eur',
  "intervalo" TEXT NOT NULL,
  "plano" "Plano" NOT NULL DEFAULT 'STARTER',
  "limite_qrs" INTEGER,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "stripe_product_id" TEXT,
  "stripe_price_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pacotes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "stripe_customer_id" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "pacote_id" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "subscricao_id" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "subscricao_estado" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "subscricao_fim" TIMESTAMP(3);
DO $$ BEGIN
  ALTER TABLE "companies" ADD CONSTRAINT "companies_pacote_id_fkey"
    FOREIGN KEY ("pacote_id") REFERENCES "pacotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "pagamentos" (
  "id" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'pendente',
  "valor_centimos" INTEGER NOT NULL,
  "moeda" TEXT NOT NULL DEFAULT 'eur',
  "descricao" TEXT,
  "email" TEXT,
  "company_id" TEXT,
  "pacote_id" TEXT,
  "qr_id" TEXT,
  "block_id" TEXT,
  "stripe_session_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pagamentos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "pagamentos_pacote_id_fkey" FOREIGN KEY ("pacote_id") REFERENCES "pacotes"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "pagamentos_stripe_session_id_key" ON "pagamentos"("stripe_session_id");
CREATE INDEX IF NOT EXISTS "pagamentos_company_id_created_at_idx" ON "pagamentos"("company_id", "created_at");

ALTER TABLE "pacotes" ADD COLUMN IF NOT EXISTS "plano" "Plano" NOT NULL DEFAULT 'STARTER';

CREATE TABLE IF NOT EXISTS "configuracoes" (
  "chave" TEXT NOT NULL,
  "valor" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "configuracoes_pkey" PRIMARY KEY ("chave")
);

-- Páginas de pagamento próprias (sem o checkout do Stripe).
ALTER TABLE "pagamentos" ADD COLUMN IF NOT EXISTS "retorno" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "subscricao_cancela" BOOLEAN NOT NULL DEFAULT false;
