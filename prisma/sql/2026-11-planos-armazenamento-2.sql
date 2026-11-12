UPDATE pacotes SET plano = 'BUSINESS' WHERE plano = 'ENTERPRISE';
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS qr_modelo_id text;
UPDATE pagamentos SET qr_modelo_id = qr_id WHERE tipo = 'qr' AND qr_modelo_id IS NULL;
CREATE TABLE IF NOT EXISTS ficheiros (
  id text PRIMARY KEY,
  company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE,
  chave text NOT NULL UNIQUE,
  bytes bigint NOT NULL,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ficheiros_company_id_idx ON ficheiros (company_id);
