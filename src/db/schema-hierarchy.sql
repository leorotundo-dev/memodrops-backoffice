-- ========================================
-- SCHEMA HIERÁRQUICO COMPLETO
-- Categorias → Concursos → Editais → Matérias → Tópicos → Subtópicos
-- ========================================

-- Requires: CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ========================================
-- 1. CATEGORIAS (Tipos de Objetivo)
-- ========================================
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,           -- Ex: "Concursos Públicos", "ENEM", "Vestibulares"
  slug TEXT NOT NULL UNIQUE,           -- Ex: "concursos-publicos", "enem", "vestibulares"
  icon TEXT,                           -- Emoji ou nome do ícone
  description TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS categories_slug_idx ON categories(slug);
CREATE INDEX IF NOT EXISTS categories_active_idx ON categories(is_active);

-- ========================================
-- 2. CONCURSOS/PROVAS (Dentro de cada categoria)
-- ========================================
CREATE TABLE IF NOT EXISTS contests (
  id SERIAL PRIMARY KEY,
  category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,                 -- Ex: "Câmara dos Deputados 2025"
  slug TEXT NOT NULL,                  -- Ex: "camara-deputados-2025"
  institution TEXT NOT NULL,           -- Ex: "Câmara dos Deputados"
  exam_date DATE,                      -- Data da prova
  vacancies INT,                       -- Número de vagas
  salary DECIMAL(10,2),                -- Salário
  education_level TEXT,                -- Ex: "Superior Completo"
  location TEXT,                       -- Ex: "Brasília/DF"
  status TEXT DEFAULT 'active',        -- active|upcoming|past|cancelled
  source_url TEXT,                     -- URL da fonte original
  is_official BOOLEAN DEFAULT false,   -- Se é oficial ou criado manualmente
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_id, slug)
);

CREATE INDEX IF NOT EXISTS contests_category_idx ON contests(category_id);
CREATE INDEX IF NOT EXISTS contests_slug_idx ON contests(slug);
CREATE INDEX IF NOT EXISTS contests_status_idx ON contests(status);
CREATE INDEX IF NOT EXISTS contests_exam_date_idx ON contests(exam_date);

-- ========================================
-- 3. EDITAIS (Dentro de cada concurso)
-- ========================================
CREATE TABLE IF NOT EXISTS editals (
  id SERIAL PRIMARY KEY,
  contest_id INT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  title TEXT NOT NULL,                 -- Ex: "Edital nº 01/2025"
  edital_number TEXT,                  -- Ex: "01/2025"
  file_url TEXT,                       -- URL do PDF do edital
  original_text TEXT,                  -- Texto extraído do PDF
  status TEXT DEFAULT 'pending',       -- pending|processing|completed|error
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS editals_contest_idx ON editals(contest_id);
CREATE INDEX IF NOT EXISTS editals_status_idx ON editals(status);

-- ========================================
-- 4. MATÉRIAS (Extraídas dos editais)
-- ========================================
CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  edital_id INT NOT NULL REFERENCES editals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- Ex: "Língua Portuguesa"
  slug TEXT NOT NULL,                  -- Ex: "lingua-portuguesa"
  weight INT DEFAULT 1,                -- Peso da matéria (1-10)
  difficulty INT DEFAULT 2,            -- Dificuldade (1=básico, 2=intermediário, 3=avançado)
  priority INT DEFAULT 5,              -- Prioridade (1-10)
  color TEXT,                          -- Cor para UI (hex)
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(edital_id, slug)
);

CREATE INDEX IF NOT EXISTS subjects_edital_idx ON subjects(edital_id);
CREATE INDEX IF NOT EXISTS subjects_slug_idx ON subjects(slug);

-- ========================================
-- 5. TÓPICOS (Dentro de cada matéria)
-- ========================================
CREATE TABLE IF NOT EXISTS topics (
  id SERIAL PRIMARY KEY,
  subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- Ex: "Interpretação de Texto"
  slug TEXT NOT NULL,                  -- Ex: "interpretacao-texto"
  description TEXT,
  difficulty INT DEFAULT 2,
  priority INT DEFAULT 5,
  estimated_concepts INT DEFAULT 10,   -- Estimativa de conceitos neste tópico
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, slug)
);

CREATE INDEX IF NOT EXISTS topics_subject_idx ON topics(subject_id);
CREATE INDEX IF NOT EXISTS topics_slug_idx ON topics(slug);

-- ========================================
-- 6. SUBTÓPICOS (Dentro de cada tópico)
-- ========================================
CREATE TABLE IF NOT EXISTS subtopics (
  id SERIAL PRIMARY KEY,
  topic_id INT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- Ex: "Figuras de Linguagem"
  slug TEXT NOT NULL,                  -- Ex: "figuras-linguagem"
  description TEXT,
  difficulty INT DEFAULT 2,
  priority INT DEFAULT 5,
  estimated_concepts INT DEFAULT 5,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(topic_id, slug)
);

CREATE INDEX IF NOT EXISTS subtopics_topic_idx ON subtopics(topic_id);
CREATE INDEX IF NOT EXISTS subtopics_slug_idx ON subtopics(slug);

-- ========================================
-- 7. HARVEST ITEMS (Provas coletadas - já existente)
-- ========================================
CREATE TABLE IF NOT EXISTS harvest_items(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  fetched_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'queued',
  http_status INT,
  title TEXT,
  content_text TEXT,
  hash TEXT,
  license TEXT,
  pii_flags JSONB DEFAULT '[]'::JSONB,
  meta JSONB DEFAULT '{}'::JSONB,
  -- Relacionamento com hierarquia
  contest_id INT REFERENCES contests(id) ON DELETE SET NULL,
  subject_id INT REFERENCES subjects(id) ON DELETE SET NULL,
  topic_id INT REFERENCES topics(id) ON DELETE SET NULL,
  UNIQUE (source, url)
);

CREATE INDEX IF NOT EXISTS harvest_items_hash_idx ON harvest_items(hash);
CREATE INDEX IF NOT EXISTS harvest_items_source_status_idx ON harvest_items(source, status);
CREATE INDEX IF NOT EXISTS harvest_items_contest_idx ON harvest_items(contest_id);
CREATE INDEX IF NOT EXISTS harvest_items_subject_idx ON harvest_items(subject_id);
CREATE INDEX IF NOT EXISTS harvest_items_topic_idx ON harvest_items(topic_id);

-- ========================================
-- 8. POPULAR DADOS INICIAIS
-- ========================================

-- Categorias padrão
INSERT INTO categories (name, slug, icon, description, display_order) VALUES
  ('Concursos Públicos', 'concursos-publicos', '🎯', 'Concursos públicos federais, estaduais e municipais', 1),
  ('ENEM', 'enem', '📚', 'Exame Nacional do Ensino Médio', 2),
  ('Vestibulares', 'vestibulares', '🎓', 'Vestibulares de universidades públicas e privadas', 3),
  ('Escola/Faculdade', 'escola-faculdade', '📖', 'Conteúdo para ensino fundamental, médio e superior', 4),
  ('Certificações', 'certificacoes', '💼', 'Certificações profissionais e técnicas', 5),
  ('Outros', 'outros', '🌍', 'Outros objetivos de estudo', 6)
ON CONFLICT (slug) DO NOTHING;

-- ========================================
-- 9. FUNÇÕES AUXILIARES
-- ========================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contests_updated_at BEFORE UPDATE ON contests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_editals_updated_at BEFORE UPDATE ON editals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON subjects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_topics_updated_at BEFORE UPDATE ON topics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subtopics_updated_at BEFORE UPDATE ON subtopics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
