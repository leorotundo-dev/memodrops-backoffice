-- Migration: 005_create_drops_and_cache
-- Descrição: Cria as tabelas drops e drop_cache para armazenar drops gerados e cache
-- Data: 2025-11-07

CREATE TABLE IF NOT EXISTS drops (
  id SERIAL PRIMARY KEY,
  blueprint_id INT NOT NULL REFERENCES exam_blueprints(id) ON DELETE CASCADE,
  subject_id INT REFERENCES subjects(id) ON DELETE SET NULL,
  drop_text TEXT NOT NULL,
  drop_type TEXT NOT NULL, -- fundamento, regra/excecao, pattern_banca, etc.
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  metadata JSONB, -- metadados adicionais (camada cognitiva, dificuldade, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drop_cache (
  id SERIAL PRIMARY KEY,
  blueprint_id INT NOT NULL,
  subject_id INT,
  content_hash TEXT NOT NULL UNIQUE,
  drop_id INT NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para melhorar performance
CREATE INDEX idx_drops_blueprint ON drops(blueprint_id);
CREATE INDEX idx_drops_subject ON drops(subject_id);
CREATE INDEX idx_drops_type ON drops(drop_type);
CREATE INDEX idx_drops_created_at ON drops(created_at DESC);

CREATE INDEX idx_drop_cache_hash ON drop_cache(content_hash);
CREATE INDEX idx_drop_cache_blueprint_subject ON drop_cache(blueprint_id, subject_id);

-- Comentários para documentação
COMMENT ON TABLE drops IS 'Armazena os drops de estudo gerados via LLM';
COMMENT ON COLUMN drops.blueprint_id IS 'Referência ao blueprint do edital';
COMMENT ON COLUMN drops.subject_id IS 'Referência à matéria/tópico';
COMMENT ON COLUMN drops.drop_text IS 'Texto do drop de estudo';
COMMENT ON COLUMN drops.drop_type IS 'Tipo do drop: fundamento, regra/exceção, pattern_banca, etc.';
COMMENT ON COLUMN drops.metadata IS 'Metadados pedagógicos (camada cognitiva, dificuldade, etc.)';

COMMENT ON TABLE drop_cache IS 'Cache para evitar geração duplicada de drops';
COMMENT ON COLUMN drop_cache.content_hash IS 'Hash do conteúdo para identificar duplicatas';
