-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'GESTOR_EMPRESA', 'GESTOR_QR', 'VISUALIZADOR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ATIVO', 'INATIVO', 'SUSPENSO');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ATIVA', 'SUSPENSA', 'INATIVA');

-- CreateEnum
CREATE TYPE "Plano" AS ENUM ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ATIVA', 'CANCELADA', 'EXPIRADA', 'PENDENTE');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('TEXTO', 'LINK', 'IMAGEM', 'VIDEO', 'PDF', 'CHAT', 'FEED', 'FORMULARIO', 'MAPA', 'GALERIA', 'PLAYLIST');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VISUALIZADOR',
    "status" "UserStatus" NOT NULL DEFAULT 'ATIVO',
    "company_id" TEXT,
    "ultimo_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "website" TEXT,
    "cor_primaria" TEXT,
    "cor_secundaria" TEXT,
    "estado" "CompanyStatus" NOT NULL DEFAULT 'ATIVA',
    "plano" "Plano" NOT NULL DEFAULT 'FREE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_codes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "slug" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "template_id" TEXT,
    "logo" TEXT,
    "cor_primaria" TEXT,
    "cor_secundaria" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'rascunho',
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "scans_total" INTEGER NOT NULL DEFAULT 0,
    "ultimo_scan" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qr_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_blocks" (
    "id" TEXT NOT NULL,
    "qr_id" TEXT NOT NULL,
    "tipo" "BlockType" NOT NULL,
    "titulo" TEXT NOT NULL,
    "icone" TEXT,
    "conteudo" JSONB,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qr_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT,
    "icone" TEXT,
    "preview" TEXT,
    "estrutura_json" JSONB,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics" (
    "id" TEXT NOT NULL,
    "qr_id" TEXT NOT NULL,
    "data_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pais" TEXT,
    "cidade" TEXT,
    "idioma" TEXT,
    "dispositivo" TEXT,
    "navegador" TEXT,
    "sistema_operativo" TEXT,
    "ip" TEXT,

    CONSTRAINT "analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "plano" "Plano" NOT NULL DEFAULT 'FREE',
    "limite_qrs" INTEGER,
    "valor_mensal" DECIMAL(10,2),
    "estado" "SubscriptionStatus" NOT NULL DEFAULT 'ATIVA',
    "data_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_fim" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_company_id_idx" ON "users"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "qr_codes_slug_key" ON "qr_codes"("slug");

-- CreateIndex
CREATE INDEX "qr_codes_company_id_idx" ON "qr_codes"("company_id");

-- CreateIndex
CREATE INDEX "qr_codes_template_id_idx" ON "qr_codes"("template_id");

-- CreateIndex
CREATE INDEX "qr_blocks_qr_id_idx" ON "qr_blocks"("qr_id");

-- CreateIndex
CREATE INDEX "files_company_id_idx" ON "files"("company_id");

-- CreateIndex
CREATE INDEX "analytics_qr_id_idx" ON "analytics"("qr_id");

-- CreateIndex
CREATE INDEX "analytics_data_hora_idx" ON "analytics"("data_hora");

-- CreateIndex
CREATE INDEX "subscriptions_company_id_idx" ON "subscriptions"("company_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_blocks" ADD CONSTRAINT "qr_blocks_qr_id_fkey" FOREIGN KEY ("qr_id") REFERENCES "qr_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics" ADD CONSTRAINT "analytics_qr_id_fkey" FOREIGN KEY ("qr_id") REFERENCES "qr_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
