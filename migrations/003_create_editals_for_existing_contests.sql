-- Criar editais para concursos existentes que não têm edital
INSERT INTO editals (contest_id, title, slug, number, status, created_at)
SELECT 
  c.id,
  'Edital - ' || c.title as title,
  'edital-' || c.slug as slug,
  '001/' || EXTRACT(YEAR FROM c.created_at) as number,
  'open' as status,
  c.created_at
FROM contests c
WHERE NOT EXISTS (
  SELECT 1 FROM editals e WHERE e.contest_id = c.id
)
ON CONFLICT (contest_id, slug) DO NOTHING;

-- Associar matérias existentes aos editais criados
INSERT INTO edital_subjects (edital_id, subject_id, created_at)
SELECT 
  e.id as edital_id,
  s.id as subject_id,
  NOW() as created_at
FROM subjects s
INNER JOIN editals e ON s.contest_id = e.contest_id
WHERE NOT EXISTS (
  SELECT 1 FROM edital_subjects es 
  WHERE es.edital_id = e.id AND es.subject_id = s.id
)
ON CONFLICT (edital_id, subject_id) DO NOTHING;
