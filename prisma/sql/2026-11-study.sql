CREATE TABLE IF NOT EXISTS "study_sessoes" (
  "id" TEXT PRIMARY KEY,
  "estado" TEXT NOT NULL DEFAULT 'a_ler',
  "paginas" INTEGER NOT NULL,
  "lidas" INTEGER NOT NULL DEFAULT 0,
  "texto" TEXT,
  "plano" JSONB,
  "progresso" JSONB,
  "erro" TEXT,
  "ip" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "study_sessoes_ip_created_at_idx" ON "study_sessoes" ("ip", "created_at");
