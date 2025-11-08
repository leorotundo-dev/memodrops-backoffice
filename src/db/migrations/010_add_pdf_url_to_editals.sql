-- Migration 010: Adiciona coluna pdf_url à tabela editals
-- Esta coluna é usada pelo job de cleanup para verificar arquivos órfãos

-- Adicionar coluna pdf_url (alias para file_url para compatibilidade)
ALTER TABLE editals ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Copiar dados existentes de file_url para pdf_url
UPDATE editals SET pdf_url = file_url WHERE pdf_url IS NULL AND file_url IS NOT NULL;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS editals_pdf_url_idx ON editals(pdf_url) WHERE pdf_url IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN editals.pdf_url IS 'URL do PDF do edital (usado pelo job de cleanup)';
