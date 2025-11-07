// src/routes/harvester.ts
import { Router } from 'express';
import { query } from '../db/index.js';
import { normalizeSalary, normalizeDate, isValidContestTitle } from '../utils/dataFormatter.js';

const router = Router();

interface IngestRequest {
  sourceItem: {
    id: number;
    source: string;
    url: string;
    title: string;
    license: string;
  };
  structure: {
    contestName: string;
    category: string;
    subjects: Array<{
      name: string;
      topics: string[];
    }>;
    examDate?: string;
    institution?: string;
    positions?: number;
    salary?: string;
  };
}

/**
 * Endpoint para receber dados processados do harvester
 * POST /api/harvester/ingest
 */
router.post('/api/harvester/ingest', async (req, res) => {
  try {
    const { sourceItem, structure }: IngestRequest = req.body;

    console.log(`[Harvester] Recebendo ingestão: ${structure.contestName}`);

    // Validar se é um título de concurso válido
    if (!isValidContestTitle(structure.contestName)) {
      console.log(`[Harvester] ⚠️  Título inválido (conteúdo irrelevante): ${structure.contestName}`);
      return res.json({ success: false, message: 'Título inválido' });
    }

    // 1. Criar ou buscar categoria
    const categorySlug = structure.category.toLowerCase().replace(/\s+/g, '-');
    let categoryResult = await query(
      'SELECT id FROM categories WHERE slug = $1',
      [categorySlug]
    );

    let categoryId: number;
    if (categoryResult.rows.length === 0) {
      const categoryNames: Record<string, string> = {
        'legislativo': 'Legislativo',
        'judiciario': 'Judiciário',
        'executivo': 'Executivo',
        'seguranca': 'Segurança Pública',
        'fiscal': 'Fiscal',
        'educacao': 'Educação',
        'saude': 'Saúde',
        'outro': 'Outros'
      };

      const insertResult = await query(
        `INSERT INTO categories (name, slug, is_active) 
         VALUES ($1, $2, true) 
         RETURNING id`,
        [categoryNames[structure.category] || structure.category, categorySlug]
      );
      categoryId = insertResult.rows[0].id;
    } else {
      categoryId = categoryResult.rows[0].id;
    }

    // 2. Criar ou buscar instituição (banca)
    const institutionName = structure.institution || sourceItem.source;
    const institutionSlug = institutionName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    let institutionId: number | null = null;
    
    // Buscar instituição existente
    const existingInst = await query(
      'SELECT id FROM institutions WHERE LOWER(name) = LOWER($1) OR slug = $2',
      [institutionName, institutionSlug]
    );

    if (existingInst.rows.length > 0) {
      institutionId = existingInst.rows[0].id;
    } else {
      // Criar nova instituição
      const newInst = await query(
        `INSERT INTO institutions (name, slug, type, is_active, created_at)
         VALUES ($1, $2, 'exam_board', true, NOW())
         ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug
         RETURNING id`,
        [institutionName, institutionSlug]
      );
      institutionId = newInst.rows[0].id;
    }

    // 3. Criar contest
    const contestSlug = structure.contestName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const contestResult = await query(
      `INSERT INTO contests 
       (category_id, title, slug, institution, institution_id, exam_date, vacancies, salary, status, source_url, is_official, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, true, NOW())
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         institution = EXCLUDED.institution,
         exam_date = EXCLUDED.exam_date,
         vacancies = EXCLUDED.vacancies,
         salary = EXCLUDED.salary,
         source_url = EXCLUDED.source_url
       RETURNING id`,
      [
        categoryId,
        structure.contestName,
        contestSlug,
        institutionName,
        institutionId,
        normalizeDate(structure.examDate) || null,
        structure.positions || null,
        normalizeSalary(structure.salary) || null,
        sourceItem.url
      ]
    );

    const contestId = contestResult.rows[0].id;

    // 3. Criar edital associado ao concurso
    const editalTitle = `Edital - ${structure.contestName}`;
    
    const editalResult = await query(
      `INSERT INTO editals 
       (contest_id, title, edital_number, status, created_at)
       VALUES ($1, $2, $3, 'completed', NOW())
       RETURNING id`,
      [
        contestId,
        editalTitle,
        `001/${new Date().getFullYear()}` // Número padrão
      ]
    );

    const editalId = editalResult.rows[0].id;

    // 4. Criar subjects e topics
    for (const subject of structure.subjects) {
      const subjectSlug = subject.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const subjectResult = await query(
        `INSERT INTO subjects 
         (edital_id, name, slug, display_order, created_at)
         VALUES ($1, $2, $3, 0, NOW())
         ON CONFLICT (edital_id, slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [editalId, subject.name, subjectSlug]
      );

      const subjectId = subjectResult.rows[0].id;

      // Criar topics
      for (let i = 0; i < subject.topics.length; i++) {
        const topic = subject.topics[i];
        const topicSlug = topic
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        await query(
          `INSERT INTO topics 
           (subject_id, name, slug, display_order, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (subject_id, slug) DO NOTHING`,
          [subjectId, topic, topicSlug, i]
        );
      }
    }

    // 4. Marcar harvest_item como processed
    await query(
      'UPDATE harvest_items SET status = $1, processed_at = NOW() WHERE id = $2',
      ['processed', sourceItem.id]
    );

    console.log(`[Harvester] Ingestão concluída: Contest ID ${contestId}`);

    res.json({
      success: true,
      contestId,
      message: `Contest "${structure.contestName}" criado/atualizado com sucesso`
    });

  } catch (error) {
    console.error('[Harvester] Erro na ingestão:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar ingestão'
    });
  }
});

/**
 * Endpoint para listar contests coletados
 * GET /api/harvester/contests
 */
router.get('/api/harvester/contests', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        c.id,
        c.title,
        c.slug,
        c.institution,
        c.exam_date,
        c.vacancies,
        c.salary,
        c.status,
        c.source_url,
        c.created_at,
        cat.name as category_name,
        COUNT(DISTINCT s.id) as subjects_count,
        COUNT(DISTINCT t.id) as topics_count
      FROM contests c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN subjects s ON c.id = s.contest_id
      LEFT JOIN topics t ON s.id = t.subject_id
      WHERE c.is_official = true
      GROUP BY c.id, cat.name
      ORDER BY c.created_at DESC
      LIMIT 50
    `);

    res.json({
      success: true,
      contests: result.rows
    });
  } catch (error) {
    console.error('[Harvester] Erro ao listar contests:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao listar contests'
    });
  }
});

/**
 * Endpoint para obter detalhes de um contest
 * GET /api/harvester/contests/:id
 */
router.get('/api/harvester/contests/:id', async (req, res) => {
  try {
    const contestId = parseInt(req.params.id);

    const contestResult = await query(`
      SELECT 
        c.*,
        cat.name as category_name,
        cat.slug as category_slug
      FROM contests c
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.id = $1
    `, [contestId]);

    if (contestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contest não encontrado'
      });
    }

    const subjectsResult = await query(`
      SELECT 
        s.id,
        s.name,
        s.slug,
        s.display_order,
        COUNT(t.id) as topics_count
      FROM subjects s
      LEFT JOIN topics t ON s.id = t.subject_id
      WHERE s.contest_id = $1
      GROUP BY s.id
      ORDER BY s.display_order, s.name
    `, [contestId]);

    const topicsResult = await query(`
      SELECT 
        t.id,
        t.subject_id,
        t.name,
        t.slug,
        t.display_order
      FROM topics t
      INNER JOIN subjects s ON t.subject_id = s.id
      WHERE s.contest_id = $1
      ORDER BY t.subject_id, t.display_order, t.name
    `, [contestId]);

    const contest = contestResult.rows[0];
    const subjects = subjectsResult.rows.map(subject => ({
      ...subject,
      topics: topicsResult.rows.filter(t => t.subject_id === subject.id)
    }));

    res.json({
      success: true,
      contest: {
        ...contest,
        subjects
      }
    });
  } catch (error) {
    console.error('[Harvester] Erro ao obter contest:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter contest'
    });
  }
});

export default router;
