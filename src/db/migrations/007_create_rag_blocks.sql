-- Migration: 007_create_rag_blocks
-- Descrição: Cria a tabela rag_blocks para armazenar blocos de conhecimento de fontes externas
-- Data: 2025-11-07

-- Instalar extensão pgvector se ainda não estiver instalada
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela de blocos RAG (Retrieval-Augmented Generation)
CREATE TABLE IF NOT EXISTS rag_blocks (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL, -- URL ou identificador da fonte
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'video', 'article', 'book', 'manual')),
  topic_id INT REFERENCES topics(id) ON DELETE CASCADE, -- pode ser NULL para conteúdo genérico
  title TEXT, -- título do conteúdo
  content TEXT NOT NULL, -- conteúdo textual extraído
  embedding VECTOR(1536), -- embedding do conteúdo (OpenAI text-embedding-3-small)
  metadata JSONB DEFAULT '{}'::jsonb, -- metadados adicionais (autor, data, etc.)
  chunk_index INT DEFAULT 0, -- índice do chunk (para conteúdos grandes divididos)
  total_chunks INT DEFAULT 1, -- total de chunks do conteúdo
  quality_score DECIMAL(3, 2) DEFAULT 0.5 CHECK (quality_score BETWEEN 0 AND 1), -- qualidade do conteúdo
  is_verified BOOLEAN DEFAULT false, -- se o conteúdo foi verificado/aprovado
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_rag_blocks_source ON rag_blocks(source);
CREATE INDEX IF NOT EXISTS idx_rag_blocks_source_type ON rag_blocks(source_type);
CREATE INDEX IF NOT EXISTS idx_rag_blocks_topic ON rag_blocks(topic_id);
CREATE INDEX IF NOT EXISTS idx_rag_blocks_verified ON rag_blocks(is_verified);

-- Índice para busca por similaridade de embeddings (HNSW - Hierarchical Navigable Small World)
CREATE INDEX IF NOT EXISTS idx_rag_blocks_embedding ON rag_blocks USING hnsw (embedding vector_cosine_ops);

-- Comentários para documentação
COMMENT ON TABLE rag_blocks IS 'Blocos de conhecimento extraídos de fontes educacionais externas (RAG)';
COMMENT ON COLUMN rag_blocks.source IS 'URL ou identificador da fonte do conteúdo';
COMMENT ON COLUMN rag_blocks.source_type IS 'Tipo da fonte: pdf, video, article, book, manual';
COMMENT ON COLUMN rag_blocks.topic_id IS 'ID do tópico relacionado (pode ser NULL)';
COMMENT ON COLUMN rag_blocks.content IS 'Conteúdo textual extraído da fonte';
COMMENT ON COLUMN rag_blocks.embedding IS 'Embedding vetorial do conteúdo (1536 dimensões)';
COMMENT ON COLUMN rag_blocks.metadata IS 'Metadados adicionais: autor, data de publicação, etc.';
COMMENT ON COLUMN rag_blocks.chunk_index IS 'Índice do chunk (para conteúdos grandes divididos em partes)';
COMMENT ON COLUMN rag_blocks.total_chunks IS 'Total de chunks do conteúdo original';
COMMENT ON COLUMN rag_blocks.quality_score IS 'Score de qualidade do conteúdo (0-1)';
COMMENT ON COLUMN rag_blocks.is_verified IS 'Se o conteúdo foi verificado/aprovado por um humano';
