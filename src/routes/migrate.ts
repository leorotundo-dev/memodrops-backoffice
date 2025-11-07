import express, { Request, Response } from 'express';
import { pool } from '../db/index.js';

const router = express.Router();

// SQL da migration inline
const INSTITUTIONS_MIGRATION_SQL = `
-- Criar tabela de instituições (bancas organizadoras)
CREATE TABLE IF NOT EXISTS institutions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  full_name TEXT,
  website TEXT,
  logo_url TEXT,
  type TEXT DEFAULT 'exam_board',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS institutions_slug_idx ON institutions(slug);
CREATE INDEX IF NOT EXISTS institutions_type_idx ON institutions(type);
CREATE INDEX IF NOT EXISTS institutions_active_idx ON institutions(is_active);

-- Adicionar coluna institution_id na tabela contests
ALTER TABLE contests ADD COLUMN IF NOT EXISTS institution_id INT REFERENCES institutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS contests_institution_idx ON contests(institution_id);

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_institutions_updated_at ON institutions;
CREATE TRIGGER update_institutions_updated_at BEFORE UPDATE ON institutions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Popular com bancas existentes (extrair do campo institution dos contests)
INSERT INTO institutions (name, slug, full_name, type)
SELECT DISTINCT 
  institution AS name,
  LOWER(REGEXP_REPLACE(REGEXP_REPLACE(institution, '[^a-zA-Z0-9\\s-]', '', 'g'), '\\s+', '-', 'g')) AS slug,
  institution AS full_name,
  CASE 
    WHEN institution ILIKE '%câmara%' OR institution ILIKE '%senado%' OR institution ILIKE '%ministério%' THEN 'government'
    WHEN institution ILIKE '%universidade%' OR institution ILIKE '%faculdade%' THEN 'university'
    ELSE 'exam_board'
  END AS type
FROM contests
WHERE institution IS NOT NULL AND institution != ''
ON CONFLICT (name) DO NOTHING;

-- Atualizar contests com institution_id baseado no nome
UPDATE contests c
SET institution_id = i.id
FROM institutions i
WHERE c.institution = i.name
  AND c.institution_id IS NULL;

-- Adicionar bancas conhecidas
INSERT INTO institutions (name, slug, full_name, type, website) VALUES
  ('FGV', 'fgv', 'Fundação Getúlio Vargas', 'exam_board', 'https://www.fgv.br/'),
  ('Cebraspe', 'cebraspe', 'Centro Brasileiro de Pesquisa em Avaliação e Seleção e de Promoção de Eventos', 'exam_board', 'https://www.cebraspe.org.br/'),
  ('FCC', 'fcc', 'Fundação Carlos Chagas', 'exam_board', 'https://www.fcc.org.br/'),
  ('Cesgranrio', 'cesgranrio', 'Fundação Cesgranrio', 'exam_board', 'https://www.cesgranrio.org.br/'),
  ('Vunesp', 'vunesp', 'Fundação para o Vestibular da Universidade Estadual Paulista', 'exam_board', 'https://www.vunesp.com.br/'),
  ('IBFC', 'ibfc', 'Instituto Brasileiro de Formação e Capacitação', 'exam_board', 'https://www.ibfc.org.br/'),
  ('AOCP', 'aocp', 'Associação dos Oficiais da Polícia Civil', 'exam_board', 'https://www.aocp.com.br/'),
  ('Consulplan', 'consulplan', 'Consulplan Consultoria', 'exam_board', 'https://www.consulplan.net/'),
  ('Idecan', 'idecan', 'Instituto de Desenvolvimento Educacional, Cultural e Assistencial Nacional', 'exam_board', 'https://www.idecan.org.br/'),
  ('Quadrix', 'quadrix', 'Quadrix Consultoria', 'exam_board', 'https://www.quadrix.org.br/'),
  ('Instituto AOCP', 'instituto-aocp', 'Instituto AOCP', 'exam_board', 'https://www.institutoaocp.org.br/'),
  ('Fundatec', 'fundatec', 'Fundação Universidade Empresa de Tecnologia e Ciências', 'exam_board', 'https://www.fundatec.org.br/')
ON CONFLICT (name) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  website = EXCLUDED.website,
  type = EXCLUDED.type;
`;

// ========================================
// POST /api/migrate/institutions - Executar migration de institutions
// ========================================
router.post('/institutions', async (req: Request, res: Response) => {
  try {
    await pool.query(INSTITUTIONS_MIGRATION_SQL);
    
    res.json({
      success: true,
      message: 'Migration executed successfully'
    });
  } catch (error: any) {
    console.error('Error executing migration:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute migration'
    });
  }
});

// ========================================
// GET /api/migrate/status - Verificar se tabela institutions existe
// ========================================
router.get('/status', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'institutions'
      );
    `);
    
    const exists = result.rows[0].exists;
    
    if (exists) {
      const countResult = await pool.query('SELECT COUNT(*) as count FROM institutions');
      const count = parseInt(countResult.rows[0].count);
      
      res.json({
        success: true,
        table_exists: true,
        institution_count: count
      });
    } else {
      res.json({
        success: true,
        table_exists: false
      });
    }
  } catch (error: any) {
    console.error('Error checking migration status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check migration status'
    });
  }
});

export default router;
