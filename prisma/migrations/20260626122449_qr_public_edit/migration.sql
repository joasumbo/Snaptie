-- AlterTable
ALTER TABLE "qr_codes" ADD COLUMN     "edicao_pin" TEXT,
ADD COLUMN     "edicao_publica" BOOLEAN NOT NULL DEFAULT false;
