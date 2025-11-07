-- Adicionar colunas para extração de matérias nos editais
ALTER TABLE editals ADD COLUMN IF NOT EXISTS subjects_data JSONB;
ALTER TABLE editals ADD COLUMN IF NOT EXISTS subjects_confidence DECIMAL(3,2);
ALTER TABLE editals ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;

-- Criar índices
CREATE INDEX IF NOT EXISTS editals_needs_review_idx ON editals(needs_review);
CREATE INDEX IF NOT EXISTS editals_subjects_confidence_idx ON editals(subjects_confidence);

-- Criar tabela de relacionamento edital-matéria
CREATE TABLE IF NOT EXISTS edital_subjects (
  id SERIAL PRIMARY KEY,
  edital_id INT NOT NULL REFERENCES editals(id) ON DELETE CASCADE,
  subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  confidence DECIMAL(3,2),
  topics JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(edital_id, subject_id)
);

CREATE INDEX IF NOT EXISTS edital_subjects_edital_idx ON edital_subjects(edital_id);
CREATE INDEX IF NOT EXISTS edital_subjects_subject_idx ON edital_subjects(subject_id);
CREATE INDEX IF NOT EXISTS edital_subjects_confidence_idx ON edital_subjects(confidence);
