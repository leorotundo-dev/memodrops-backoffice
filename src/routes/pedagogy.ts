// src/routes/pedagogy.ts
import { Router } from 'express';
import { pool } from '../db/index.js';
import { TopicPrereqsRepository } from '../services/topicPrereqsRepository.js';
import { ExamLogsRepository } from '../services/examLogsRepository.js';

const router = Router();

/**
 * POST /api/pedagogy/prereqs
 * Adiciona um pré-requisito a um tópico
 */
router.post('/api/pedagogy/prereqs', async (req, res) => {
  try {
    const { topicId, prereqTopicId, strength } = req.body;

    if (!topicId || !prereqTopicId) {
      return res.status(400).json({
        success: false,
        error: 'topicId e prereqTopicId são obrigatórios'
      });
    }

    const topicPrereqsRepo = new TopicPrereqsRepository(pool);

    // Verificar se causaria ciclo
    const hasCycle = await topicPrereqsRepo.hasCycle(topicId, prereqTopicId);
    if (hasCycle) {
      return res.status(400).json({
        success: false,
        error: 'Adicionar este pré-requisito causaria um ciclo no grafo'
      });
    }

    const prereq = await topicPrereqsRepo.create({
      topicId,
      prereqTopicId,
      strength
    });

    res.json({
      success: true,
      prereq
    });
  } catch (error: any) {
    console.error('[Pedagogy] Erro ao adicionar pré-requisito:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pedagogy/prereqs/:topicId
 * Busca pré-requisitos de um tópico
 */
router.get('/api/pedagogy/prereqs/:topicId', async (req, res) => {
  try {
    const topicId = parseInt(req.params.topicId, 10);

    const topicPrereqsRepo = new TopicPrereqsRepository(pool);
    const prereqs = await topicPrereqsRepo.findPrereqsByTopic(topicId);

    res.json({
      success: true,
      prereqs
    });
  } catch (error: any) {
    console.error('[Pedagogy] Erro ao buscar pré-requisitos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pedagogy/prereqs/:topicId/graph
 * Busca o grafo completo de pré-requisitos de um tópico
 */
router.get('/api/pedagogy/prereqs/:topicId/graph', async (req, res) => {
  try {
    const topicId = parseInt(req.params.topicId, 10);

    const topicPrereqsRepo = new TopicPrereqsRepository(pool);
    const prereqIds = await topicPrereqsRepo.findPrereqsGraph(topicId);

    res.json({
      success: true,
      prereqIds,
      count: prereqIds.length
    });
  } catch (error: any) {
    console.error('[Pedagogy] Erro ao buscar grafo de pré-requisitos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pedagogy/dependents/:topicId
 * Busca tópicos que dependem de um tópico
 */
router.get('/api/pedagogy/dependents/:topicId', async (req, res) => {
  try {
    const topicId = parseInt(req.params.topicId, 10);

    const topicPrereqsRepo = new TopicPrereqsRepository(pool);
    const dependents = await topicPrereqsRepo.findDependentTopics(topicId);

    res.json({
      success: true,
      dependents
    });
  } catch (error: any) {
    console.error('[Pedagogy] Erro ao buscar tópicos dependentes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/pedagogy/prereqs/:topicId/:prereqTopicId
 * Remove um pré-requisito
 */
router.delete('/api/pedagogy/prereqs/:topicId/:prereqTopicId', async (req, res) => {
  try {
    const topicId = parseInt(req.params.topicId, 10);
    const prereqTopicId = parseInt(req.params.prereqTopicId, 10);

    const topicPrereqsRepo = new TopicPrereqsRepository(pool);
    const deleted = await topicPrereqsRepo.delete(topicId, prereqTopicId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Pré-requisito não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Pré-requisito removido'
    });
  } catch (error: any) {
    console.error('[Pedagogy] Erro ao remover pré-requisito:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/pedagogy/exam-logs
 * Registra um log de exame/simulado
 */
router.post('/api/pedagogy/exam-logs', async (req, res) => {
  try {
    const {
      userId,
      editalId,
      examType,
      score,
      totalQuestions,
      correctAnswers,
      timeSpentMinutes,
      topicsCovered,
      weakTopics
    } = req.body;

    if (!userId || !examType || totalQuestions === undefined || correctAnswers === undefined) {
      return res.status(400).json({
        success: false,
        error: 'userId, examType, totalQuestions e correctAnswers são obrigatórios'
      });
    }

    const examLogsRepo = new ExamLogsRepository(pool);
    const log = await examLogsRepo.create({
      userId,
      editalId,
      examType,
      score,
      totalQuestions,
      correctAnswers,
      timeSpentMinutes,
      topicsCovered,
      weakTopics
    });

    res.json({
      success: true,
      log
    });
  } catch (error: any) {
    console.error('[Pedagogy] Erro ao registrar log de exame:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pedagogy/exam-logs/user/:userId
 * Busca logs de exames de um usuário
 */
router.get('/api/pedagogy/exam-logs/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const examLogsRepo = new ExamLogsRepository(pool);
    const logs = await examLogsRepo.findByUser(userId, limit);

    res.json({
      success: true,
      logs,
      count: logs.length
    });
  } catch (error: any) {
    console.error('[Pedagogy] Erro ao buscar logs de exames:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pedagogy/exam-logs/user/:userId/stats
 * Busca estatísticas de exames de um usuário
 */
router.get('/api/pedagogy/exam-logs/user/:userId/stats', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);

    const examLogsRepo = new ExamLogsRepository(pool);
    const stats = await examLogsRepo.getUserStats(userId);

    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('[Pedagogy] Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pedagogy/exam-logs/user/:userId/weak-topics
 * Identifica tópicos fracos de um usuário
 */
router.get('/api/pedagogy/exam-logs/user/:userId/weak-topics', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const limit = parseInt(req.query.limit as string, 10) || 10;

    const examLogsRepo = new ExamLogsRepository(pool);
    const weakTopics = await examLogsRepo.getWeakTopics(userId, limit);

    res.json({
      success: true,
      weakTopics
    });
  } catch (error: any) {
    console.error('[Pedagogy] Erro ao buscar tópicos fracos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pedagogy/exam-logs/user/:userId/progress
 * Busca o progresso de um usuário ao longo do tempo
 */
router.get('/api/pedagogy/exam-logs/user/:userId/progress', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);

    const examLogsRepo = new ExamLogsRepository(pool);
    const progress = await examLogsRepo.getProgressOverTime(userId);

    res.json({
      success: true,
      progress
    });
  } catch (error: any) {
    console.error('[Pedagogy] Erro ao buscar progresso:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pedagogy/exam-logs/:logId
 * Busca um log específico
 */
router.get('/api/pedagogy/exam-logs/:logId', async (req, res) => {
  try {
    const logId = parseInt(req.params.logId, 10);

    const examLogsRepo = new ExamLogsRepository(pool);
    const log = await examLogsRepo.findById(logId);

    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Log não encontrado'
      });
    }

    res.json({
      success: true,
      log
    });
  } catch (error: any) {
    console.error('[Pedagogy] Erro ao buscar log:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/pedagogy/exam-logs/:logId
 * Deleta um log de exame
 */
router.delete('/api/pedagogy/exam-logs/:logId', async (req, res) => {
  try {
    const logId = parseInt(req.params.logId, 10);

    const examLogsRepo = new ExamLogsRepository(pool);
    const deleted = await examLogsRepo.delete(logId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Log não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Log deletado'
    });
  } catch (error: any) {
    console.error('[Pedagogy] Erro ao deletar log:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
