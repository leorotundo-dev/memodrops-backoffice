// src/routes/personalization.ts
import { Router } from 'express';
import { pool } from '../db/index.js';
import { UserRepository } from '../services/userRepository.js';
import { UserStatsRepository } from '../services/userStatsRepository.js';
import { DailyPlanRepository } from '../services/dailyPlanRepository.js';
import { PersonalizationEngine } from '../personalization/engine.js';
import { generateDailyPlan, generateDailyPlansForAllUsers, updateDailyPlanProgress } from '../jobs/daily-plan.js';

const router = Router();

/**
 * POST /api/personalization/users
 * Cria ou busca um usuário
 */
router.post('/api/personalization/users', async (req, res) => {
  try {
    const { email, name, avatarUrl, preferences } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email é obrigatório'
      });
    }

    const userRepo = new UserRepository(pool);
    const user = await userRepo.findOrCreate({
      email,
      name,
      avatarUrl,
      preferences
    });

    res.json({
      success: true,
      user
    });
  } catch (error: any) {
    console.error('[Personalization] Erro ao criar usuário:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/personalization/users/:userId
 * Busca um usuário por ID
 */
router.get('/api/personalization/users/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);

    const userRepo = new UserRepository(pool);
    const user = await userRepo.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error: any) {
    console.error('[Personalization] Erro ao buscar usuário:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/personalization/stats
 * Registra uma resposta do usuário a um drop
 */
router.post('/api/personalization/stats', async (req, res) => {
  try {
    const { userId, dropId, isCorrect, confidenceLevel, timeSpentSeconds } = req.body;

    if (!userId || !dropId || isCorrect === undefined) {
      return res.status(400).json({
        success: false,
        error: 'userId, dropId e isCorrect são obrigatórios'
      });
    }

    const userStatsRepo = new UserStatsRepository(pool);
    const stat = await userStatsRepo.create({
      userId,
      dropId,
      isCorrect,
      confidenceLevel,
      timeSpentSeconds
    });

    // Atualizar progresso do plano diário
    if (timeSpentSeconds) {
      const timeSpentMinutes = Math.ceil(timeSpentSeconds / 60);
      await updateDailyPlanProgress(userId, dropId, timeSpentMinutes);
    }

    res.json({
      success: true,
      stat
    });
  } catch (error: any) {
    console.error('[Personalization] Erro ao registrar estatística:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/personalization/stats/:userId
 * Busca estatísticas de um usuário
 */
router.get('/api/personalization/stats/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);

    const userStatsRepo = new UserStatsRepository(pool);
    const performance = await userStatsRepo.getUserPerformance(userId);

    res.json({
      success: true,
      performance
    });
  } catch (error: any) {
    console.error('[Personalization] Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/personalization/daily-plan
 * Gera um plano diário para um usuário
 */
router.post('/api/personalization/daily-plan', async (req, res) => {
  try {
    const { userId, date, targetDropsCount, subjectId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId é obrigatório'
      });
    }

    const planDate = date ? new Date(date) : new Date();

    const result = await generateDailyPlan({
      userId,
      date: planDate,
      targetDropsCount,
      subjectId
    });

    res.json({
      success: true,
      plan: result
    });
  } catch (error: any) {
    console.error('[Personalization] Erro ao gerar plano diário:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/personalization/daily-plan/:userId
 * Busca o plano diário de hoje de um usuário
 */
router.get('/api/personalization/daily-plan/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);

    const dailyPlanRepo = new DailyPlanRepository(pool);
    const plan = await dailyPlanRepo.findTodayPlan(userId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plano diário não encontrado para hoje'
      });
    }

    res.json({
      success: true,
      plan
    });
  } catch (error: any) {
    console.error('[Personalization] Erro ao buscar plano diário:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/personalization/daily-plan/:userId/history
 * Busca o histórico de planos diários de um usuário
 */
router.get('/api/personalization/daily-plan/:userId/history', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const limit = parseInt(req.query.limit as string, 10) || 30;

    const dailyPlanRepo = new DailyPlanRepository(pool);
    const plans = await dailyPlanRepo.findByUser(userId, limit);

    res.json({
      success: true,
      plans
    });
  } catch (error: any) {
    console.error('[Personalization] Erro ao buscar histórico de planos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/personalization/knowledge-gaps/:userId
 * Identifica gaps de conhecimento de um usuário
 */
router.get('/api/personalization/knowledge-gaps/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);

    const personalizationEngine = new PersonalizationEngine(pool);
    const gaps = await personalizationEngine.identifyKnowledgeGaps(userId);

    res.json({
      success: true,
      gaps
    });
  } catch (error: any) {
    console.error('[Personalization] Erro ao identificar gaps:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /admin/personalization/generate-all-plans
 * Gera planos diários para todos os usuários ativos (admin only)
 */
router.post('/admin/personalization/generate-all-plans', async (req, res) => {
  try {
    console.log('[Personalization] Gerando planos para todos os usuários...');

    const result = await generateDailyPlansForAllUsers();

    res.json({
      success: true,
      message: `${result.generated} planos gerados, ${result.errors} erros`,
      stats: result
    });
  } catch (error: any) {
    console.error('[Personalization] Erro ao gerar planos para todos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
