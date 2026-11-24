ALTER TABLE "pagamentos"
  ADD COLUMN IF NOT EXISTS "produto_id" TEXT,
  ADD COLUMN IF NOT EXISTS "quantidade" INTEGER,
  ADD COLUMN IF NOT EXISTS "telefone_cliente" TEXT,
  ADD COLUMN IF NOT EXISTS "envio_estado" TEXT,
  ADD COLUMN IF NOT EXISTS "envio_codigo" TEXT,
  ADD COLUMN IF NOT EXISTS "enviado_em" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "pagamentos_envio_estado_idx" ON "pagamentos" ("envio_estado");
CREATE TABLE IF NOT EXISTS "produtos_envio" (
  "id" TEXT PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "descricao" TEXT,
  "imagem" TEXT,
  "preco_centimos" INTEGER NOT NULL,
  "portes_centimos" INTEGER NOT NULL DEFAULT 0,
  "qr_modelo_id" TEXT,
  "stock" INTEGER,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
