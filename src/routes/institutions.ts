import express, { Request, Response } from 'express';
import { pool } from '../db';

const router = express.Router();

// ========================================
// GET /api/institutions - Listar todas as bancas
// ========================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type, active } = req.query;
    
    let query = `
      SELECT 
        i.*,
        COUNT(DISTINCT c.id) as contest_count,
        MAX(c.exam_date) as latest_exam_date
      FROM institutions i
      LEFT JOIN contests c ON c.institution_id = i.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (type) {
      params.push(type);
      query += ` AND i.type = $${params.length}`;
    }
    
    if (active !== undefined) {
      params.push(active === 'true');
      query += ` AND i.is_active = $${params.length}`;
    }
    
    query += `
      GROUP BY i.id
      ORDER BY contest_count DESC, i.name ASC
    `;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching institutions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch institutions'
    });
  }
});

// ========================================
// GET /api/institutions/stats - Estatísticas das bancas
// ========================================
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT i.id) as total_institutions,
        COUNT(DISTINCT CASE WHEN i.is_active THEN i.id END) as active_institutions,
        COUNT(DISTINCT CASE WHEN i.type = 'exam_board' THEN i.id END) as exam_boards,
        COUNT(DISTINCT CASE WHEN i.type = 'government' THEN i.id END) as government,
        COUNT(DISTINCT CASE WHEN i.type = 'university' THEN i.id END) as universities,
        COUNT(DISTINCT c.id) as total_contests
      FROM institutions i
      LEFT JOIN contests c ON c.institution_id = i.id
    `;
    
    const topInstitutionsQuery = `
      SELECT 
        i.id,
        i.name,
        i.slug,
        i.type,
        COUNT(DISTINCT c.id) as contest_count,
        MAX(c.exam_date) as latest_exam_date
      FROM institutions i
      LEFT JOIN contests c ON c.institution_id = i.id
      WHERE i.is_active = true
      GROUP BY i.id, i.name, i.slug, i.type
      ORDER BY contest_count DESC
      LIMIT 10
    `;
    
    const [statsResult, topResult] = await Promise.all([
      pool.query(statsQuery),
      pool.query(topInstitutionsQuery)
    ]);
    
    res.json({
      success: true,
      data: {
        stats: statsResult.rows[0],
        top_institutions: topResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching institution stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch institution stats'
    });
  }
});

// ========================================
// GET /api/institutions/:id - Obter detalhes de uma banca
// ========================================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const institutionQuery = `
      SELECT 
        i.*,
        COUNT(DISTINCT c.id) as contest_count,
        COUNT(DISTINCT e.id) as edital_count,
        MAX(c.exam_date) as latest_exam_date,
        MIN(c.exam_date) as earliest_exam_date
      FROM institutions i
      LEFT JOIN contests c ON c.institution_id = i.id
      LEFT JOIN editals e ON e.contest_id = c.id
      WHERE i.id = $1
      GROUP BY i.id
    `;
    
    const contestsQuery = `
      SELECT 
        c.id,
        c.title,
        c.slug,
        c.exam_date,
        c.vacancies,
        c.status,
        cat.name as category_name,
        COUNT(DISTINCT e.id) as edital_count
      FROM contests c
      LEFT JOIN categories cat ON cat.id = c.category_id
      LEFT JOIN editals e ON e.contest_id = c.id
      WHERE c.institution_id = $1
      GROUP BY c.id, cat.name
      ORDER BY c.exam_date DESC NULLS LAST, c.created_at DESC
      LIMIT 50
    `;
    
    const [institutionResult, contestsResult] = await Promise.all([
      pool.query(institutionQuery, [id]),
      pool.query(contestsQuery, [id])
    ]);
    
    if (institutionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Institution not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        institution: institutionResult.rows[0],
        contests: contestsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching institution details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch institution details'
    });
  }
});

// ========================================
// POST /api/institutions - Criar nova banca
// ========================================
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, full_name, website, logo_url, type, description, is_active } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }
    
    // Gerar slug a partir do nome
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
      .replace(/\s+/g, '-') // Substitui espaços por hífens
      .replace(/-+/g, '-') // Remove hífens duplicados
      .trim();
    
    const query = `
      INSERT INTO institutions (name, slug, full_name, website, logo_url, type, description, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      name,
      slug,
      full_name || name,
      website || null,
      logo_url || null,
      type || 'exam_board',
      description || null,
      is_active !== undefined ? is_active : true
    ];
    
    const result = await pool.query(query, values);
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error creating institution:', error);
    
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({
        success: false,
        error: 'Institution with this name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create institution'
    });
  }
});

// ========================================
// PUT /api/institutions/:id - Atualizar banca
// ========================================
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, full_name, website, logo_url, type, description, is_active } = req.body;
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
      
      // Atualizar slug também
      const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      
      updates.push(`slug = $${paramCount}`);
      values.push(slug);
      paramCount++;
    }
    
    if (full_name !== undefined) {
      updates.push(`full_name = $${paramCount}`);
      values.push(full_name);
      paramCount++;
    }
    
    if (website !== undefined) {
      updates.push(`website = $${paramCount}`);
      values.push(website);
      paramCount++;
    }
    
    if (logo_url !== undefined) {
      updates.push(`logo_url = $${paramCount}`);
      values.push(logo_url);
      paramCount++;
    }
    
    if (type !== undefined) {
      updates.push(`type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }
    
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }
    
    values.push(id);
    
    const query = `
      UPDATE institutions
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Institution not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error updating institution:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Institution with this name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update institution'
    });
  }
});

// ========================================
// DELETE /api/institutions/:id - Deletar banca
// ========================================
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Verificar se há concursos vinculados
    const contestCheck = await pool.query(
      'SELECT COUNT(*) as count FROM contests WHERE institution_id = $1',
      [id]
    );
    
    const contestCount = parseInt(contestCheck.rows[0].count);
    
    if (contestCount > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete institution with ${contestCount} associated contests. Please reassign or delete contests first.`,
        contest_count: contestCount
      });
    }
    
    const result = await pool.query(
      'DELETE FROM institutions WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Institution not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting institution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete institution'
    });
  }
});

export default router;
