CREATE TABLE IF NOT EXISTS "study_uso" (
  "id" TEXT PRIMARY KEY,
  "sessao_id" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "entrada" INTEGER NOT NULL,
  "saida" INTEGER NOT NULL,
  "ms" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "study_uso_sessao_id_idx" ON "study_uso" ("sessao_id");
CREATE INDEX IF NOT EXISTS "study_uso_created_at_idx" ON "study_uso" ("created_at");
