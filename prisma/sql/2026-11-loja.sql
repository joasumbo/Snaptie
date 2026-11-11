-- Loja: QRs à venda e entrega da cópia comprada.
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS preco_venda_centimos integer;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS qr_comprado_id text;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS qr_entregue_em timestamp(3);
CREATE INDEX IF NOT EXISTS qr_codes_preco_venda_idx ON qr_codes (preco_venda_centimos) WHERE preco_venda_centimos IS NOT NULL;
