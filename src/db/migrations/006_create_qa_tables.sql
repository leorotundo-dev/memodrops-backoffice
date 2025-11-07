-- Migration: 006_create_qa_tables
-- Descrição: Cria as tabelas qa_reviews e drop_metrics para QA e métricas
-- Data: 2025-11-07

-- Tabela de revisões de QA (avaliações de qualidade dos drops)
CREATE TABLE IF NOT EXISTS qa_reviews (
  id SERIAL PRIMARY KEY,
  drop_id INT NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('human', 'automated')),
  reviewer_id INT, -- ID do usuário revisor (NULL para automated)
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'needs_revision')),
  quality_score DECIMAL(3, 2) CHECK (quality_score BETWEEN 0 AND 1), -- 0.00 a 1.00
  feedback JSONB DEFAULT '{}'::jsonb, -- feedback estruturado
  notes TEXT, -- notas adicionais
  reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de métricas de drops (desempenho e qualidade)
CREATE TABLE IF NOT EXISTS drop_metrics (
  id SERIAL PRIMARY KEY,
  drop_id INT NOT NULL REFERENCES drops(id) ON DELETE CASCADE UNIQUE,
  total_views INT DEFAULT 0, -- quantas vezes o drop foi visto
  total_attempts INT DEFAULT 0, -- quantas vezes foi respondido
  correct_attempts INT DEFAULT 0, -- quantas vezes foi acertado
  accuracy_rate DECIMAL(5, 2) DEFAULT 0, -- taxa de acerto (%)
  avg_confidence DECIMAL(3, 2) DEFAULT 0, -- confiança média (1-5)
  avg_time_seconds INT DEFAULT 0, -- tempo médio de resposta
  difficulty_score DECIMAL(3, 2) DEFAULT 0.5, -- dificuldade calculada (0-1)
  quality_score DECIMAL(3, 2) DEFAULT 0, -- score de qualidade (0-1)
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para melhorar performance
CREATE INDEX idx_qa_reviews_drop ON qa_reviews(drop_id);
CREATE INDEX idx_qa_reviews_status ON qa_reviews(status);
CREATE INDEX idx_qa_reviews_reviewer_type ON qa_reviews(reviewer_type);
CREATE INDEX idx_qa_reviews_reviewed_at ON qa_reviews(reviewed_at DESC);
CREATE INDEX idx_qa_reviews_drop_status ON qa_reviews(drop_id, status);

CREATE INDEX idx_drop_metrics_drop ON drop_metrics(drop_id);
CREATE INDEX idx_drop_metrics_accuracy ON drop_metrics(accuracy_rate DESC);
CREATE INDEX idx_drop_metrics_quality ON drop_metrics(quality_score DESC);
CREATE INDEX idx_drop_metrics_difficulty ON drop_metrics(difficulty_score);
CREATE INDEX idx_drop_metrics_last_updated ON drop_metrics(last_updated DESC);

-- Comentários para documentação
COMMENT ON TABLE qa_reviews IS 'Revisões de qualidade dos drops (humanas e automatizadas)';
COMMENT ON COLUMN qa_reviews.reviewer_type IS 'Tipo de revisor: human (humano) ou automated (automático)';
COMMENT ON COLUMN qa_reviews.reviewer_id IS 'ID do usuário revisor (NULL para revisões automatizadas)';
COMMENT ON COLUMN qa_reviews.status IS 'Status da revisão: pending, approved, rejected, needs_revision';
COMMENT ON COLUMN qa_reviews.quality_score IS 'Score de qualidade (0.00 a 1.00): 0=péssimo, 1=excelente';
COMMENT ON COLUMN qa_reviews.feedback IS 'Feedback estruturado (JSON): problemas encontrados, sugestões, etc.';

COMMENT ON TABLE drop_metrics IS 'Métricas de desempenho e qualidade dos drops';
COMMENT ON COLUMN drop_metrics.total_views IS 'Quantas vezes o drop foi visualizado';
COMMENT ON COLUMN drop_metrics.total_attempts IS 'Quantas vezes o drop foi respondido';
COMMENT ON COLUMN drop_metrics.correct_attempts IS 'Quantas vezes o drop foi acertado';
COMMENT ON COLUMN drop_metrics.accuracy_rate IS 'Taxa de acerto (%) calculada';
COMMENT ON COLUMN drop_metrics.avg_confidence IS 'Nível médio de confiança dos usuários (1-5)';
COMMENT ON COLUMN drop_metrics.avg_time_seconds IS 'Tempo médio de resposta em segundos';
COMMENT ON COLUMN drop_metrics.difficulty_score IS 'Dificuldade calculada (0=fácil, 1=difícil)';
COMMENT ON COLUMN drop_metrics.quality_score IS 'Score de qualidade geral (0-1)';

-- Tabela de métricas diárias (custos e estatísticas)
CREATE TABLE IF NOT EXISTS metrics_daily (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  drops_generated INT DEFAULT 0,
  drops_approved INT DEFAULT 0,
  drops_rejected INT DEFAULT 0,
  qa_evaluations INT DEFAULT 0,
  cost_openai DECIMAL(10, 4) DEFAULT 0,
  cost_railway DECIMAL(10, 4) DEFAULT 0,
  total_cost DECIMAL(10, 4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca por data
CREATE INDEX idx_metrics_daily_date ON metrics_daily(date DESC);

-- Comentários para documentação
COMMENT ON TABLE metrics_daily IS 'Métricas diárias de custos e estatísticas do sistema';
COMMENT ON COLUMN metrics_daily.drops_generated IS 'Quantidade de drops gerados no dia';
COMMENT ON COLUMN metrics_daily.drops_approved IS 'Quantidade de drops aprovados no dia';
COMMENT ON COLUMN metrics_daily.drops_rejected IS 'Quantidade de drops rejeitados no dia';
COMMENT ON COLUMN metrics_daily.qa_evaluations IS 'Quantidade de avaliações de QA realizadas';
COMMENT ON COLUMN metrics_daily.cost_openai IS 'Custo da OpenAI no dia (USD)';
COMMENT ON COLUMN metrics_daily.cost_railway IS 'Custo do Railway no dia (USD)';
COMMENT ON COLUMN metrics_daily.total_cost IS 'Custo total do dia (USD)';
