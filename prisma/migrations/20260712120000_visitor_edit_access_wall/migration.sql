-- Edição da personalização pelo visitante, modos de acesso ao QR e mural de mensagens.
-- Puramente aditiva: não altera nem remove nada do que já existe.

-- AlterTable: qr_codes
ALTER TABLE "qr_codes"
  ADD COLUMN IF NOT EXISTS "edicao_personalizacao" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "acesso_modo" TEXT NOT NULL DEFAULT 'aberto',
  ADD COLUMN IF NOT EXISTS "acesso_pin" TEXT,
  ADD COLUMN IF NOT EXISTS "ativado_em" TIMESTAMP(3);

-- CreateTable: qr_messages (mural de visitantes)
CREATE TABLE IF NOT EXISTS "qr_messages" (
    "id" TEXT NOT NULL,
    "block_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "imagem" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qr_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "qr_messages_block_id_created_at_idx" ON "qr_messages"("block_id", "created_at");

-- AddForeignKey
ALTER TABLE "qr_messages"
  DROP CONSTRAINT IF EXISTS "qr_messages_block_id_fkey";
ALTER TABLE "qr_messages"
  ADD CONSTRAINT "qr_messages_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "qr_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
