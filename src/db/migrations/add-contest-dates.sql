-- Adicionar colunas de datas nos concursos
ALTER TABLE contests ADD COLUMN IF NOT EXISTS registration_start DATE;
ALTER TABLE contests ADD COLUMN IF NOT EXISTS registration_end DATE;
ALTER TABLE contests ADD COLUMN IF NOT EXISTS exam_date DATE;
ALTER TABLE contests ADD COLUMN IF NOT EXISTS result_date DATE;

-- Adicionar coluna structured_data nos editais
ALTER TABLE editals ADD COLUMN IF NOT EXISTS structured_data JSONB;

-- Criar índices
CREATE INDEX IF NOT EXISTS contests_registration_start_idx ON contests(registration_start);
CREATE INDEX IF NOT EXISTS contests_exam_date_idx ON contests(exam_date);
