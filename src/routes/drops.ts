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

export default router;
