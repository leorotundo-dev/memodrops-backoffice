// src/routes/drops.ts
import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

/**
 * Endpoint para obter drops do dia para um usuário
 * GET /api/drops/today?userId=123
 */
router.get('/api/drops/today', async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId é obrigatório'
      });
    }

    // Buscar drops do dia para todos os planos ativos do usuário
    const result = await query(`
      SELECT 
        spi.id as item_id,
        spi.scheduled_date,
        spi.status,
        spi.completed_at,
        kp.id as pill_id,
        kp.title,
        kp.content,
        kp.mnemonic,
        kp.mindmap,
        kp.flashcard,
        kp.estimated_minutes,
        kp.difficulty,
        t.name as topic_name,
        s.name as subject_name,
        s.slug as subject_slug,
        c.title as contest_name,
        c.slug as contest_slug
      FROM study_plan_items spi
      INNER JOIN study_plans sp ON spi.plan_id = sp.id
      INNER JOIN knowledgePills kp ON spi.pill_id = kp.id
      INNER JOIN topics t ON kp.topic_id = t.id
      INNER JOIN subjects s ON t.subject_id = s.id
      INNER JOIN contests c ON s.contest_id = c.id
      WHERE sp.user_id = $1
      AND sp.status = 'active'
      AND spi.scheduled_date = CURRENT_DATE
      ORDER BY spi.created_at ASC
    `, [userId]);

    const drops = result.rows.map(row => ({
      itemId: row.item_id,
      pillId: row.pill_id,
      title: row.title,
      content: row.content,
      memorizationTechniques: {
        mnemonic: row.mnemonic,
        mindmap: row.mindmap,
        flashcard: row.flashcard
      },
      estimatedMinutes: row.estimated_minutes,
      difficulty: row.difficulty,
      topic: row.topic_name,
      subject: {
        name: row.subject_name,
        slug: row.subject_slug
      },
      contest: {
        name: row.contest_name,
        slug: row.contest_slug
      },
      scheduledDate: row.scheduled_date,
      status: row.status,
      completedAt: row.completed_at
    }));

    res.json({
      success: true,
      date: new Date().toISOString().split('T')[0],
      drops,
      stats: {
        total: drops.length,
        completed: drops.filter(d => d.status === 'completed').length,
        pending: drops.filter(d => d.status === 'pending').length,
        totalMinutes: drops.reduce((sum, d) => sum + d.estimatedMinutes, 0)
      }
    });
  } catch (error) {
    console.error('[Drops] Erro ao buscar drops do dia:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar drops do dia'
    });
  }
});

/**
 * Endpoint para marcar um drop como completo
 * POST /api/drops/:itemId/complete
 */
router.post('/api/drops/:itemId/complete', async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId);

    await query(
      `UPDATE study_plan_items 
       SET status = 'completed', completed_at = NOW()
       WHERE id = $1`,
      [itemId]
    );

    res.json({
      success: true,
      message: 'Drop marcado como completo'
    });
  } catch (error) {
    console.error('[Drops] Erro ao completar drop:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao completar drop'
    });
  }
});

/**
 * Endpoint para obter histórico de drops
 * GET /api/drops/history?userId=123&limit=30
 */
router.get('/api/drops/history', async (req, res) => {
  try {
    const userId = req.query.userId;
    const limit = parseInt(req.query.limit as string) || 30;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId é obrigatório'
      });
    }

    const result = await query(`
      SELECT 
        spi.scheduled_date,
        spi.status,
        spi.completed_at,
        kp.title,
        kp.estimated_minutes,
        s.name as subject_name,
        c.title as contest_name
      FROM study_plan_items spi
      INNER JOIN study_plans sp ON spi.plan_id = sp.id
      INNER JOIN knowledgePills kp ON spi.pill_id = kp.id
      INNER JOIN topics t ON kp.topic_id = t.id
      INNER JOIN subjects s ON t.subject_id = s.id
      INNER JOIN contests c ON s.contest_id = c.id
      WHERE sp.user_id = $1
      AND spi.scheduled_date < CURRENT_DATE
      ORDER BY spi.scheduled_date DESC, spi.created_at DESC
      LIMIT $2
    `, [userId, limit]);

    res.json({
      success: true,
      history: result.rows
    });
  } catch (error) {
    console.error('[Drops] Erro ao buscar histórico:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar histórico'
    });
  }
});

/**
 * Endpoint para obter estatísticas de progresso
 * GET /api/drops/stats?userId=123
 */
router.get('/api/drops/stats', async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId é obrigatório'
      });
    }

    // Stats gerais
    const totalResult = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        SUM(CASE WHEN status = 'completed' THEN kp.estimated_minutes ELSE 0 END) as minutes_studied
      FROM study_plan_items spi
      INNER JOIN study_plans sp ON spi.plan_id = sp.id
      INNER JOIN knowledgePills kp ON spi.pill_id = kp.id
      WHERE sp.user_id = $1
    `, [userId]);

    // Stats por matéria
    const subjectResult = await query(`
      SELECT 
        s.name as subject_name,
        COUNT(*) as total_drops,
        COUNT(CASE WHEN spi.status = 'completed' THEN 1 END) as completed_drops,
        ROUND(
          COUNT(CASE WHEN spi.status = 'completed' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as progress_percent
      FROM study_plan_items spi
      INNER JOIN study_plans sp ON spi.plan_id = sp.id
      INNER JOIN knowledgePills kp ON spi.pill_id = kp.id
      INNER JOIN topics t ON kp.topic_id = t.id
      INNER JOIN subjects s ON t.subject_id = s.id
      WHERE sp.user_id = $1
      GROUP BY s.id, s.name
      ORDER BY progress_percent DESC
    `, [userId]);

    // Streak (dias consecutivos)
    const streakResult = await query(`
      WITH daily_completion AS (
        SELECT 
          scheduled_date,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) > 0 as has_completion
        FROM study_plan_items spi
        INNER JOIN study_plans sp ON spi.plan_id = sp.id
        WHERE sp.user_id = $1
        AND scheduled_date <= CURRENT_DATE
        GROUP BY scheduled_date
        ORDER BY scheduled_date DESC
      )
      SELECT COUNT(*) as streak
      FROM daily_completion
      WHERE has_completion = true
      AND scheduled_date >= (
        SELECT COALESCE(MIN(scheduled_date), CURRENT_DATE)
        FROM daily_completion
        WHERE has_completion = false
        AND scheduled_date <= CURRENT_DATE
      )
    `, [userId]);

    const stats = totalResult.rows[0];
    const bySubject = subjectResult.rows;
    const streak = parseInt(streakResult.rows[0]?.streak || '0');

    res.json({
      success: true,
      stats: {
        totalDrops: parseInt(stats.total),
        completedDrops: parseInt(stats.completed),
        minutesStudied: parseInt(stats.minutes_studied || '0'),
        completionRate: stats.total > 0 
          ? Math.round((stats.completed / stats.total) * 100) 
          : 0,
        currentStreak: streak
      },
      bySubject
    });
  } catch (error) {
    console.error('[Drops] Erro ao buscar stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar estatísticas'
    });
  }
});

/**
 * Endpoint para gerar drops baseado em uma matéria de um edital
 * POST /api/drops/generate
 * Body: { editalId: number, subjectName: string, topicLimit?: number }
 */
router.post('/api/drops/generate', async (req, res) => {
  try {
    const { editalId, subjectName, topicLimit = 5 } = req.body;

    if (!editalId || !subjectName) {
      return res.status(400).json({
        success: false,
        error: 'editalId e subjectName são obrigatórios'
      });
    }

    // Buscar edital com conteúdo
    const editalResult = await query(`
      SELECT id, title, content_text, subjects_data
      FROM editals
      WHERE id = $1
    `, [editalId]);

    if (editalResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Edital não encontrado'
      });
    }

    const edital = editalResult.rows[0];

    if (!edital.content_text) {
      return res.status(400).json({
        success: false,
        error: 'Edital não possui conteúdo extraído'
      });
    }

    // Usar LLM para gerar drops
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI();

    const prompt = `Você é um especialista em educação e criação de conteúdo didático para concursos públicos.

Gere EXATAMENTE ${topicLimit} "drops" (pílulas de conhecimento) sobre a matéria "${subjectName}" baseado no conteúdo abaixo.

Cada drop deve ter:
- Título claro e objetivo
- Conteúdo didático de 200-300 palavras
- Uma técnica de memorização (mnemônico OU flashcard)
- Dificuldade: "easy", "medium" ou "hard"
- Tempo estimado: 5 a 15 minutos
- Nome do tópico específico

Conteúdo do edital:
${edital.content_text.substring(0, 3000)}

RETORNE APENAS UM JSON com este formato EXATO (sem texto adicional):
{
  "drops": [
    {
      "title": "Título do drop",
      "content": "Conteúdo didático detalhado",
      "mnemonic": "Técnica mnemônica",
      "mindmap": null,
      "flashcard": null,
      "difficulty": "medium",
      "estimated_minutes": 10,
      "topic_name": "Nome do tópico"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: 'Você é um especialista em educação para concursos públicos.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    });

    const responseText = completion.choices[0].message.content;
    console.log('[Drops] Resposta do LLM:', responseText.substring(0, 500));
    
    let dropsData;
    
    try {
      const parsed = JSON.parse(responseText);
      dropsData = parsed.drops || parsed.data || (Array.isArray(parsed) ? parsed : [parsed]);
      console.log('[Drops] Drops parseados:', dropsData.length);
    } catch (err) {
      console.error('[Drops] Erro ao parsear resposta do LLM:', responseText);
      return res.status(500).json({
        success: false,
        error: 'Erro ao processar resposta do LLM',
        debug: responseText.substring(0, 500)
      });
    }
    
    if (!Array.isArray(dropsData) || dropsData.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'LLM não retornou drops válidos',
        debug: { parsed: dropsData, raw: responseText.substring(0, 500) }
      });
    }

    // Buscar ou criar exam_blueprint
    let blueprintId;
    
    // Buscar harvest_item do edital
    // Remover prefixo "Edital - " se existir
    const searchTitle = edital.title.replace(/^Edital - /, '').substring(0, 50);
    
    const harvestResult = await query(`
      SELECT hi.id
      FROM harvest_items hi
      WHERE hi.title LIKE '%' || $1 || '%'
      AND hi.status = 'processed'
      LIMIT 1
    `, [searchTitle]);
    
    if (harvestResult.rows.length > 0) {
      const harvestItemId = harvestResult.rows[0].id;
      
      // Buscar blueprint existente
      const blueprintResult = await query(`
        SELECT id FROM exam_blueprints
        WHERE harvest_item_id = $1
        LIMIT 1
      `, [harvestItemId]);
      
      if (blueprintResult.rows.length > 0) {
        blueprintId = blueprintResult.rows[0].id;
      } else {
        // Criar novo blueprint
        const newBlueprint = await query(`
          INSERT INTO exam_blueprints (
            harvest_item_id,
            model,
            prompt_version,
            raw_response,
            structured_data
          ) VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [
          harvestItemId,
          'gpt-4.1-mini',
          'v1.0',
          JSON.stringify({}),
          JSON.stringify({ edital_id: editalId, source: 'auto_generation' })
        ]);
        blueprintId = newBlueprint.rows[0].id;
      }
    } else {
      return res.status(500).json({
        success: false,
        error: 'Harvest item não encontrado para este edital'
      });
    }

    // Salvar drops no banco
    const savedDrops = [];
    
    for (const drop of dropsData) {
      // Buscar ou criar tópico
      let topicId;
      
      // Primeiro, buscar tópico existente
      const existingTopic = await query(`
        SELECT t.id
        FROM topics t
        INNER JOIN subjects s ON t.subject_id = s.id
        INNER JOIN editals e ON s.edital_id = e.id
        WHERE e.id = $1
        AND LOWER(s.name) = LOWER($2)
        AND LOWER(t.name) = LOWER($3)
      `, [editalId, subjectName, drop.topic_name || 'Geral']);
      
      if (existingTopic.rows.length > 0) {
        topicId = existingTopic.rows[0].id;
      } else {
        // Criar novo tópico
        const newTopic = await query(`
          INSERT INTO topics (name, subject_id, slug, created_at)
          SELECT $1, s.id, $2, NOW()
          FROM subjects s
          INNER JOIN editals e ON s.edital_id = e.id
          WHERE e.id = $3
          AND LOWER(s.name) = LOWER($4)
          RETURNING id
        `, [
          drop.topic_name || 'Geral',
          (drop.topic_name || 'geral').toLowerCase().replace(/\s+/g, '-'),
          editalId,
          subjectName
        ]);
        
        if (newTopic.rows.length > 0) {
          topicId = newTopic.rows[0].id;
        } else {
          console.log('Não foi possível criar tópico para:', drop.topic_name);
          continue; // Skip este drop
        }
      }

      // Buscar subject_id
      const subjectResult = await query(`
        SELECT s.id
        FROM subjects s
        INNER JOIN editals e ON s.edital_id = e.id
        WHERE e.id = $1
        AND LOWER(s.name) = LOWER($2)
      `, [editalId, subjectName]);
      
      if (subjectResult.rows.length === 0) {
        console.log('Subject não encontrado para:', subjectName);
        continue;
      }
      
      const subjectId = subjectResult.rows[0].id;
      
      // Criar drop
      const metadata = {
        title: drop.title,
        topic: drop.topic_name,
        mnemonic: drop.mnemonic,
        mindmap: drop.mindmap,
        flashcard: drop.flashcard,
        difficulty: drop.difficulty || 'medium'
      };
      
      const pedagogy_metadata = {
        estimated_minutes: drop.estimated_minutes || 10,
        cognitive_level: drop.difficulty || 'medium',
        topic_id: topicId
      };
      
      const pillResult = await query(`
        INSERT INTO drops (
          blueprint_id,
          subject_id,
          drop_text,
          drop_type,
          model,
          prompt_version,
          metadata,
          pedagogy_metadata,
          estimated_time_seconds,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id
      `, [
        blueprintId, // blueprint_id
        subjectId,
        drop.content,
        'knowledge_pill',
        'gpt-4.1-mini',
        'v1.0',
        JSON.stringify(metadata),
        JSON.stringify(pedagogy_metadata),
        (drop.estimated_minutes || 10) * 60 // converter para segundos
      ]);

      savedDrops.push({
        id: pillResult.rows[0].id,
        ...drop
      });
    }

    res.json({
      success: true,
      message: `${savedDrops.length} drops gerados com sucesso`,
      data: {
        editalId,
        editalTitle: edital.title,
        subjectName,
        dropsGenerated: savedDrops.length,
        drops: savedDrops
      }
    });
  } catch (error) {
    console.error('[Drops] Erro ao gerar drops:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao gerar drops: ' + error.message
    });
  }
});

export default router;
