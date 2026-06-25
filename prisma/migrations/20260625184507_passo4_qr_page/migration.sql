-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BlockType" ADD VALUE 'WHATSAPP';
ALTER TYPE "BlockType" ADD VALUE 'TELEFONE';
ALTER TYPE "BlockType" ADD VALUE 'EMAIL';
ALTER TYPE "BlockType" ADD VALUE 'WIFI';
ALTER TYPE "BlockType" ADD VALUE 'CARROSSEL';

-- AlterTable
ALTER TABLE "qr_blocks" ADD COLUMN     "cor" TEXT,
ADD COLUMN     "descricao" TEXT;

-- AlterTable
ALTER TABLE "qr_codes" ADD COLUMN     "imagem_capa" TEXT,
ADD COLUMN     "logo_forma" TEXT NOT NULL DEFAULT 'circulo',
ADD COLUMN     "logo_tamanho" TEXT NOT NULL DEFAULT 'M',
ADD COLUMN     "nome_tamanho" TEXT NOT NULL DEFAULT 'M';
