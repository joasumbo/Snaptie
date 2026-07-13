-- Tentativas falhadas de PIN, para travar força bruta nos códigos públicos.
-- Puramente aditiva.

CREATE TABLE IF NOT EXISTS "pin_attempts" (
    "chave" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_ate" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pin_attempts_pkey" PRIMARY KEY ("chave")
);
