-- Adicionar extensão pg_trgm para busca por similaridade
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Adicionar índice GIN para busca rápida por similaridade em contests.title
CREATE INDEX IF NOT EXISTS contests_title_trgm_idx ON contests USING gin (title gin_trgm_ops);

-- Adicionar coluna error em harvest_items se não existir
ALTER TABLE harvest_items ADD COLUMN IF NOT EXISTS error TEXT;
