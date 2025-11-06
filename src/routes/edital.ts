/**
 * Rotas de API para Editais
 * 
 * Endpoints REST para gerenciamento de editais:
 * - Upload de PDF
 * - Criação de edital
 * - Listagem de editais
 * - Processamento com IA
 * - Consulta de matérias, tópicos e subtópicos
 */

import { Router } from 'express';
import { uploadMiddleware, handleUpload } from '../handlers/uploadHandler.js';
import { 
  processEdital, 
  getEditalSubjects, 
  getSubjectTopics, 
  getTopicSubtopics,
  calculateEditalStats 
} from '../handlers/editalParser.js';
import { query } from '../db/index.js';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

/**
 * POST /api/edital/upload
 * Upload de arquivo PDF do edital
 */
router.post('/api/edital/upload', uploadMiddleware, handleUpload);

/**
 * POST /api/edital/create
 * Cria edital e inicia processamento com IA
 */
router.post('/api/edital/create', async (req, res) => {
  try {
    const { contestId, title, editalNumber, fileUrl, originalText } = req.body;

    // Validações
    if (!contestId) {
      return res.status(400).json({ error: 'contestId é obrigatório' });
    }
    if (!title) {
      return res.status(400).json({ error: 'title é obrigatório' });
    }
    if (!fileUrl && !originalText) {
      return res.status(400).json({ error: 'fileUrl ou originalText é obrigatório' });
    }

    // Se fileUrl foi fornecido, extrair texto do PDF
    let text = originalText;
    if (fileUrl && !text) {
      // TODO: Implementar extração de texto do PDF
      // Por enquanto, retornar erro
      return res.status(400).json({ error: 'Extração de texto do PDF não implementada ainda. Forneça originalText.' });
    }

    // Inserir edital no banco
    const result = await query(
      `INSERT INTO editals (contest_id, title, edital_number, file_url, original_text, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [contestId, title, editalNumber || null, fileUrl || null, text, 'pending']
    );

    const edital = result.rows[0];

    // Processar edital em background
    processEdital(edital.id).catch(err => {
      console.error('[API] Error processing edital:', err);
    });

    res.json({
      success: true,
      data: edital,
      meta: {
        message: 'Edital criado com sucesso. Processamento iniciado.',
      },
    });
  } catch (error) {
    console.error('[API] Error creating edital:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao criar edital' 
    });
  }
});

/**
 * GET /api/edital/:id
 * Busca edital por ID
 */
router.get('/api/edital/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM editals WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Edital não encontrado' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[API] Error fetching edital:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro ao buscar edital' 
    });
  }
});

/**
 * GET /api/edital/:id/subjects
 * Lista matérias de um edital
 */
router.get('/api/edital/:id/subjects', async (req, res) => {
  try {
    const { id } = req.params;

    const subjects = await getEditalSubjects(parseInt(id));

    res.json({
      success: true,
      data: subjects,
      meta: {
        total: subjects.length,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching subjects:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro ao buscar matérias' 
    });
  }
});

/**
 * GET /api/subject/:id/topics
 * Lista tópicos de uma matéria
 */
router.get('/api/subject/:id/topics', async (req, res) => {
  try {
    const { id } = req.params;

    const topics = await getSubjectTopics(parseInt(id));

    res.json({
      success: true,
      data: topics,
      meta: {
        total: topics.length,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching topics:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro ao buscar tópicos' 
    });
  }
});

/**
 * GET /api/topic/:id/subtopics
 * Lista subtópicos de um tópico
 */
router.get('/api/topic/:id/subtopics', async (req, res) => {
  try {
    const { id } = req.params;

    const subtopics = await getTopicSubtopics(parseInt(id));

    res.json({
      success: true,
      data: subtopics,
      meta: {
        total: subtopics.length,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching subtopics:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro ao buscar subtópicos' 
    });
  }
});

/**
 * GET /api/edital/:id/stats
 * Calcula estatísticas do edital
 */
router.get('/api/edital/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const stats = await calculateEditalStats(parseInt(id));

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[API] Error calculating stats:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro ao calcular estatísticas' 
    });
  }
});

/**
 * GET /api/contest/:id/editals
 * Lista editais de um concurso
 */
router.get('/api/contest/:id/editals', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM editals WHERE contest_id = $1 ORDER BY created_at DESC',
      [id]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: {
        total: result.rows.length,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching editals:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro ao buscar editais' 
    });
  }
});

/**
 * GET /uploads/:filename
 * Serve arquivos de upload
 */
router.get('/uploads/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join('/tmp/editals', filename);

    // Verificar se arquivo existe
    await fs.access(filePath);

    // Servir arquivo
    res.sendFile(filePath);
  } catch (error) {
    console.error('[API] Error serving file:', error);
    res.status(404).json({ error: 'Arquivo não encontrado' });
  }
});

export default router;
