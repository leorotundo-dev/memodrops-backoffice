-- Migration: 004_create_exam_blueprints
-- Descrição: Cria a tabela exam_blueprints para armazenar estruturas extraídas de editais
-- Data: 2025-11-07

CREATE TABLE IF NOT EXISTS exam_blueprints (
  id SERIAL PRIMARY KEY,
  harvest_item_id UUID NOT NULL REFERENCES harvest_items(id) ON DELETE CASCADE,
  model TEXT NOT NULL, -- e.g., gpt-4o-mini
  prompt_version TEXT NOT NULL,
  raw_response JSONB NOT NULL,
  structured_data JSONB NOT NULL, -- { banca, disciplinas, topicos, prioridades }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para melhorar performance de consultas
CREATE INDEX idx_exam_blueprints_harvest_item ON exam_blueprints(harvest_item_id);
CREATE INDEX idx_exam_blueprints_created_at ON exam_blueprints(created_at DESC);

-- Comentários para documentação
COMMENT ON TABLE exam_blueprints IS 'Armazena estruturas de editais extraídas via LLM';
COMMENT ON COLUMN exam_blueprints.harvest_item_id IS 'Referência ao item coletado do harvester';
COMMENT ON COLUMN exam_blueprints.model IS 'Modelo de LLM usado na extração (ex: gpt-4o-mini)';
COMMENT ON COLUMN exam_blueprints.prompt_version IS 'Versão do prompt usado na extração';
COMMENT ON COLUMN exam_blueprints.raw_response IS 'Resposta bruta do LLM em JSON';
COMMENT ON COLUMN exam_blueprints.structured_data IS 'Dados estruturados: banca, disciplinas, tópicos, prioridades';
