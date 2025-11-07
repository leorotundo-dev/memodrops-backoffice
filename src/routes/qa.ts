// src/routes/qa.ts
import { Router } from 'express';
import { pool } from '../db/index.js';
import { QAReviewRepository } from '../services/qaReviewRepository.js';
import { DropMetricsRepository } from '../services/dropMetricsRepository.js';
import { AutomatedQA } from '../qa/automated-qa.js';
import { MetricsDailyRepository } from '../services/metricsDailyRepository.js';

const router = Router();

/**
 * POST /api/qa/evaluate/:dropId
 * Avalia a qualidade de um drop usando QA automático
 */
router.post('/api/qa/evaluate/:dropId', async (req, res) => {
  try {
    const dropId = parseInt(req.params.dropId, 10);

    const automatedQA = new AutomatedQA(pool);
    const result = await automatedQA.evaluateDrop(dropId);

    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    console.error('[QA] Erro ao avaliar drop:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/qa/evaluate-batch
 * Avalia múltiplos drops em lote
 */
router.post('/api/qa/evaluate-batch', async (req, res) => {
  try {
    const { dropIds } = req.body;

    if (!dropIds || !Array.isArray(dropIds)) {
      return res.status(400).json({
        success: false,
        error: 'dropIds deve ser um array'
      });
    }

    const automatedQA = new AutomatedQA(pool);
    const results = await automatedQA.evaluateDrops(dropIds);

    res.json({
      success: true,
      results,
      total: results.length
    });
  } catch (error: any) {
    console.error('[QA] Erro ao avaliar drops em lote:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/qa/reviews/:dropId
 * Busca todas as revisões de um drop
 */
router.get('/api/qa/reviews/:dropId', async (req, res) => {
  try {
    const dropId = parseInt(req.params.dropId, 10);

    const qaReviewRepo = new QAReviewRepository(pool);
    const reviews = await qaReviewRepo.findByDrop(dropId);

    res.json({
      success: true,
      reviews
    });
  } catch (error: any) {
    console.error('[QA] Erro ao buscar revisões:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/qa/reviews/status/:status
 * Busca revisões por status
 */
router.get('/api/qa/reviews/status/:status', async (req, res) => {
  try {
    const status = req.params.status as 'pending' | 'approved' | 'rejected' | 'needs_revision';
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const qaReviewRepo = new QAReviewRepository(pool);
    const reviews = await qaReviewRepo.findByStatus(status, limit);

    res.json({
      success: true,
      reviews,
      count: reviews.length
    });
  } catch (error: any) {
    console.error('[QA] Erro ao buscar revisões por status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/qa/reviews/:reviewId
 * Atualiza uma revisão
 */
router.put('/api/qa/reviews/:reviewId', async (req, res) => {
  try {
    const reviewId = parseInt(req.params.reviewId, 10);
    const { status, qualityScore, feedback, notes } = req.body;

    const qaReviewRepo = new QAReviewRepository(pool);
    const review = await qaReviewRepo.update(reviewId, {
      status,
      qualityScore,
      feedback,
      notes
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Revisão não encontrada'
      });
    }

    res.json({
      success: true,
      review
    });
  } catch (error: any) {
    console.error('[QA] Erro ao atualizar revisão:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/qa/stats
 * Busca estatísticas de QA
 */
router.get('/api/qa/stats', async (req, res) => {
  try {
    const qaReviewRepo = new QAReviewRepository(pool);
    const stats = await qaReviewRepo.getQAStats();

    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('[QA] Erro ao buscar estatísticas de QA:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/metrics/:dropId
 * Busca métricas de um drop
 */
router.get('/api/metrics/:dropId', async (req, res) => {
  try {
    const dropId = parseInt(req.params.dropId, 10);

    const dropMetricsRepo = new DropMetricsRepository(pool);
    const metrics = await dropMetricsRepo.findByDrop(dropId);

    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'Métricas não encontradas'
      });
    }

    res.json({
      success: true,
      metrics
    });
  } catch (error: any) {
    console.error('[Metrics] Erro ao buscar métricas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/metrics/:dropId/view
 * Registra uma visualização de drop
 */
router.post('/api/metrics/:dropId/view', async (req, res) => {
  try {
    const dropId = parseInt(req.params.dropId, 10);

    const dropMetricsRepo = new DropMetricsRepository(pool);
    const metrics = await dropMetricsRepo.incrementViews(dropId);

    res.json({
      success: true,
      metrics
    });
  } catch (error: any) {
    console.error('[Metrics] Erro ao registrar visualização:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/metrics/:dropId/attempt
 * Registra uma tentativa de resposta
 */
router.post('/api/metrics/:dropId/attempt', async (req, res) => {
  try {
    const dropId = parseInt(req.params.dropId, 10);
    const { isCorrect, confidenceLevel, timeSpentSeconds } = req.body;

    if (isCorrect === undefined) {
      return res.status(400).json({
        success: false,
        error: 'isCorrect é obrigatório'
      });
    }

    const dropMetricsRepo = new DropMetricsRepository(pool);
    const metrics = await dropMetricsRepo.recordAttempt(
      dropId,
      isCorrect,
      confidenceLevel,
      timeSpentSeconds
    );

    res.json({
      success: true,
      metrics
    });
  } catch (error: any) {
    console.error('[Metrics] Erro ao registrar tentativa:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/metrics/stats
 * Busca estatísticas gerais de métricas
 */
router.get('/api/metrics/stats', async (req, res) => {
  try {
    const dropMetricsRepo = new DropMetricsRepository(pool);
    const stats = await dropMetricsRepo.getOverallStats();

    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('[Metrics] Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/metrics/low-quality
 * Busca drops com baixa qualidade
 */
router.get('/api/metrics/low-quality', async (req, res) => {
  try {
    const threshold = parseFloat(req.query.threshold as string) || 0.5;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const dropMetricsRepo = new DropMetricsRepository(pool);
    const drops = await dropMetricsRepo.findLowQualityDrops(threshold, limit);

    res.json({
      success: true,
      drops,
      count: drops.length
    });
  } catch (error: any) {
    console.error('[Metrics] Erro ao buscar drops de baixa qualidade:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/metrics/high-difficulty
 * Busca drops com alta dificuldade
 */
router.get('/api/metrics/high-difficulty', async (req, res) => {
  try {
    const threshold = parseFloat(req.query.threshold as string) || 0.7;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const dropMetricsRepo = new DropMetricsRepository(pool);
    const drops = await dropMetricsRepo.findHighDifficultyDrops(threshold, limit);

    res.json({
      success: true,
      drops,
      count: drops.length
    });
  } catch (error: any) {
    console.error('[Metrics] Erro ao buscar drops de alta dificuldade:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/qa/needs-review
 * Identifica drops que precisam de revisão
 */
router.get('/api/qa/needs-review', async (req, res) => {
  try {
    const automatedQA = new AutomatedQA(pool);
    const dropIds = await automatedQA.identifyDropsNeedingReview();

    res.json({
      success: true,
      dropIds,
      count: dropIds.length
    });
  } catch (error: any) {
    console.error('[QA] Erro ao identificar drops para revisão:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/metrics/daily
 * Busca métricas diárias (custos e estatísticas)
 */
router.get('/api/metrics/daily', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 30;

    const metricsDailyRepo = new MetricsDailyRepository(pool);
    const metrics = await metricsDailyRepo.findLastNDays(days);

    res.json({
      success: true,
      metrics,
      count: metrics.length
    });
  } catch (error: any) {
    console.error('[Metrics] Erro ao buscar métricas diárias:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/metrics/daily/:date
 * Busca métricas de um dia específico
 */
router.get('/api/metrics/daily/:date', async (req, res) => {
  try {
    const date = req.params.date;

    const metricsDailyRepo = new MetricsDailyRepository(pool);
    const metrics = await metricsDailyRepo.findByDate(date);

    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'Métricas não encontradas para esta data'
      });
    }

    res.json({
      success: true,
      metrics
    });
  } catch (error: any) {
    console.error('[Metrics] Erro ao buscar métricas do dia:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/metrics/daily/period/:startDate/:endDate
 * Busca métricas de um período
 */
router.get('/api/metrics/daily/period/:startDate/:endDate', async (req, res) => {
  try {
    const { startDate, endDate } = req.params;

    const metricsDailyRepo = new MetricsDailyRepository(pool);
    const metrics = await metricsDailyRepo.findByPeriod(startDate, endDate);
    const totals = await metricsDailyRepo.getTotals(startDate, endDate);

    res.json({
      success: true,
      metrics,
      totals,
      count: metrics.length
    });
  } catch (error: any) {
    console.error('[Metrics] Erro ao buscar métricas do período:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/metrics/daily/today
 * Busca métricas de hoje
 */
router.get('/api/metrics/daily/today', async (req, res) => {
  try {
    const metricsDailyRepo = new MetricsDailyRepository(pool);
    const metrics = await metricsDailyRepo.getToday();

    res.json({
      success: true,
      metrics
    });
  } catch (error: any) {
    console.error('[Metrics] Erro ao buscar métricas de hoje:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
