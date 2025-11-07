-- Migration: 009_create_pedagogy_tables
-- Descrição: Cria as tabelas topic_prereqs e exam_logs para estrutura pedagógica
-- Data: 2025-11-07

-- Tabela de pré-requisitos entre tópicos
CREATE TABLE IF NOT EXISTS topic_prereqs (
  topic_id INT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  prereq_topic_id INT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  strength DECIMAL(3, 2) DEFAULT 1.0 CHECK (strength BETWEEN 0 AND 1), -- força do pré-requisito (0=fraco, 1=forte)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (topic_id, prereq_topic_id),
  CHECK (topic_id != prereq_topic_id) -- evita auto-referência
);

-- Tabela de logs de simulados/provas
CREATE TABLE IF NOT EXISTS exam_logs (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  edital_id INT, -- pode ser NULL para simulados genéricos
  exam_type TEXT NOT NULL CHECK (exam_type IN ('simulado', 'prova_real', 'revisao')),
  score DECIMAL(5, 2) CHECK (score BETWEEN 0 AND 100), -- nota (0-100)
  total_questions INT DEFAULT 0,
  correct_answers INT DEFAULT 0,
  time_spent_minutes INT, -- tempo gasto em minutos
  topics_covered INT[], -- IDs dos tópicos cobertos
  weak_topics INT[], -- IDs dos tópicos com baixo desempenho
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar metadados pedagógicos à tabela drops
ALTER TABLE drops ADD COLUMN IF NOT EXISTS cognitive_level TEXT CHECK (cognitive_level IN ('lembrar', 'entender', 'aplicar', 'analisar', 'avaliar', 'criar'));
ALTER TABLE drops ADD COLUMN IF NOT EXISTS pedagogy_metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE drops ADD COLUMN IF NOT EXISTS estimated_time_seconds INT DEFAULT 30; -- tempo estimado para responder

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_topic_prereqs_topic ON topic_prereqs(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_prereqs_prereq ON topic_prereqs(prereq_topic_id);
CREATE INDEX IF NOT EXISTS idx_exam_logs_user ON exam_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_logs_edital ON exam_logs(edital_id);
CREATE INDEX IF NOT EXISTS idx_exam_logs_completed_at ON exam_logs(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_drops_cognitive_level ON drops(cognitive_level);

-- Comentários para documentação
COMMENT ON TABLE topic_prereqs IS 'Pré-requisitos entre tópicos (grafo de dependências)';
COMMENT ON COLUMN topic_prereqs.topic_id IS 'ID do tópico que requer o pré-requisito';
COMMENT ON COLUMN topic_prereqs.prereq_topic_id IS 'ID do tópico que é pré-requisito';
COMMENT ON COLUMN topic_prereqs.strength IS 'Força do pré-requisito (0=fraco, 1=forte/essencial)';

COMMENT ON TABLE exam_logs IS 'Logs de simulados e provas realizadas pelos usuários';
COMMENT ON COLUMN exam_logs.exam_type IS 'Tipo de exame: simulado, prova_real, revisao';
COMMENT ON COLUMN exam_logs.score IS 'Nota obtida (0-100)';
COMMENT ON COLUMN exam_logs.topics_covered IS 'Array com IDs dos tópicos cobertos no exame';
COMMENT ON COLUMN exam_logs.weak_topics IS 'Array com IDs dos tópicos com baixo desempenho';

COMMENT ON COLUMN drops.cognitive_level IS 'Nível cognitivo da Taxonomia de Bloom: lembrar, entender, aplicar, analisar, avaliar, criar';
COMMENT ON COLUMN drops.pedagogy_metadata IS 'Metadados pedagógicos adicionais (JSON): dificuldade, contexto, etc.';
COMMENT ON COLUMN drops.estimated_time_seconds IS 'Tempo estimado para responder o drop (segundos)';
