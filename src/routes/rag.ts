// src/routes/rag.ts
import { Router } from 'express';
import { pool } from '../db/index.js';
import { RAGBlocksRepository } from '../services/ragBlocksRepository.js';
import { AdapterFactory } from '../rag/adapters.js';
import { EmbeddingsService } from '../rag/embeddings.js';

const router = Router();

/**
 * POST /api/rag/ingest
 * Ingere conteúdo de uma URL e cria blocos RAG
 */
router.post('/api/rag/ingest', async (req, res) => {
  try {
    const { url, topicId, sourceType } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL é obrigatória'
      });
    }

    // Extrair conteúdo usando adapter apropriado
    const adapter = AdapterFactory.create(url);
    const extracted = await adapter.extract(url);

    // Dividir conteúdo em chunks
    const chunks = adapter['chunkContent'](extracted.content, 1000);

    // Gerar embeddings para os chunks
    const embeddingsService = new EmbeddingsService();
    const embeddings = await embeddingsService.generateEmbeddings(chunks);

    // Salvar blocos no banco
    const ragBlocksRepo = new RAGBlocksRepository(pool);
    const blocks = [];

    for (let i = 0; i < chunks.length; i++) {
      const block = await ragBlocksRepo.create({
        source: url,
        sourceType: sourceType || 'article',
        topicId,
        title: i === 0 ? extracted.title : `${extracted.title} (Parte ${i + 1})`,
        content: chunks[i],
        embedding: embeddings[i],
        metadata: extracted.metadata,
        chunkIndex: i,
        totalChunks: chunks.length
      });

      blocks.push(block);
    }

    res.json({
      success: true,
      message: `${blocks.length} blocos criados com sucesso`,
      blocks
    });
  } catch (error: any) {
    console.error('[RAG] Erro ao ingerir conteúdo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rag/search
 * Busca blocos RAG por similaridade semântica
 */
router.post('/api/rag/search', async (req, res) => {
  try {
    const { query, limit, topicId, sourceType, minQualityScore, onlyVerified } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query é obrigatória'
      });
    }

    // Gerar embedding da query
    const embeddingsService = new EmbeddingsService();
    const queryEmbedding = await embeddingsService.generateEmbedding(query);

    // Buscar blocos similares
    const ragBlocksRepo = new RAGBlocksRepository(pool);
    const blocks = await ragBlocksRepo.searchBySimilarity({
      embedding: queryEmbedding,
      limit: limit || 10,
      topicId,
      sourceType,
      minQualityScore,
      onlyVerified
    });

    res.json({
      success: true,
      query,
      blocks,
      count: blocks.length
    });
  } catch (error: any) {
    console.error('[RAG] Erro ao buscar blocos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rag/blocks/:id
 * Busca um bloco específico
 */
router.get('/api/rag/blocks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const ragBlocksRepo = new RAGBlocksRepository(pool);
    const block = await ragBlocksRepo.findById(id);

    if (!block) {
      return res.status(404).json({
        success: false,
        error: 'Bloco não encontrado'
      });
    }

    res.json({
      success: true,
      block
    });
  } catch (error: any) {
    console.error('[RAG] Erro ao buscar bloco:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rag/blocks/source/:source
 * Busca blocos por fonte
 */
router.get('/api/rag/blocks/source', async (req, res) => {
  try {
    const source = req.query.url as string;

    if (!source) {
      return res.status(400).json({
        success: false,
        error: 'URL da fonte é obrigatória'
      });
    }

    const ragBlocksRepo = new RAGBlocksRepository(pool);
    const blocks = await ragBlocksRepo.findBySource(source);

    res.json({
      success: true,
      source,
      blocks,
      count: blocks.length
    });
  } catch (error: any) {
    console.error('[RAG] Erro ao buscar blocos por fonte:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rag/blocks/topic/:topicId
 * Busca blocos por tópico
 */
router.get('/api/rag/blocks/topic/:topicId', async (req, res) => {
  try {
    const topicId = parseInt(req.params.topicId, 10);
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const ragBlocksRepo = new RAGBlocksRepository(pool);
    const blocks = await ragBlocksRepo.findByTopic(topicId, limit);

    res.json({
      success: true,
      topicId,
      blocks,
      count: blocks.length
    });
  } catch (error: any) {
    console.error('[RAG] Erro ao buscar blocos por tópico:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rag/blocks/unverified
 * Lista blocos não verificados
 */
router.get('/api/rag/blocks/unverified', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const ragBlocksRepo = new RAGBlocksRepository(pool);
    const blocks = await ragBlocksRepo.findUnverified(limit);

    res.json({
      success: true,
      blocks,
      count: blocks.length
    });
  } catch (error: any) {
    console.error('[RAG] Erro ao buscar blocos não verificados:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/rag/blocks/:id/verify
 * Marca um bloco como verificado
 */
router.put('/api/rag/blocks/:id/verify', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const ragBlocksRepo = new RAGBlocksRepository(pool);
    const block = await ragBlocksRepo.markAsVerified(id);

    res.json({
      success: true,
      message: 'Bloco marcado como verificado',
      block
    });
  } catch (error: any) {
    console.error('[RAG] Erro ao verificar bloco:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/rag/blocks/:id/quality-score
 * Atualiza o quality score de um bloco
 */
router.put('/api/rag/blocks/:id/quality-score', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { qualityScore } = req.body;

    if (qualityScore === undefined || qualityScore < 0 || qualityScore > 1) {
      return res.status(400).json({
        success: false,
        error: 'qualityScore deve estar entre 0 e 1'
      });
    }

    const ragBlocksRepo = new RAGBlocksRepository(pool);
    const block = await ragBlocksRepo.updateQualityScore(id, qualityScore);

    res.json({
      success: true,
      message: 'Quality score atualizado',
      block
    });
  } catch (error: any) {
    console.error('[RAG] Erro ao atualizar quality score:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/rag/blocks/:id
 * Deleta um bloco
 */
router.delete('/api/rag/blocks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const ragBlocksRepo = new RAGBlocksRepository(pool);
    const deleted = await ragBlocksRepo.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Bloco não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Bloco deletado'
    });
  } catch (error: any) {
    console.error('[RAG] Erro ao deletar bloco:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/rag/blocks/source
 * Deleta todos os blocos de uma fonte
 */
router.delete('/api/rag/blocks/source', async (req, res) => {
  try {
    const source = req.query.url as string;

    if (!source) {
      return res.status(400).json({
        success: false,
        error: 'URL da fonte é obrigatória'
      });
    }

    const ragBlocksRepo = new RAGBlocksRepository(pool);
    const deletedCount = await ragBlocksRepo.deleteBySource(source);

    res.json({
      success: true,
      message: `${deletedCount} blocos deletados`,
      deletedCount
    });
  } catch (error: any) {
    console.error('[RAG] Erro ao deletar blocos por fonte:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rag/stats
 * Estatísticas de blocos RAG
 */
router.get('/api/rag/stats', async (req, res) => {
  try {
    const ragBlocksRepo = new RAGBlocksRepository(pool);
    const countBySourceType = await ragBlocksRepo.countBySourceType();

    res.json({
      success: true,
      stats: {
        countBySourceType
      }
    });
  } catch (error: any) {
    console.error('[RAG] Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
