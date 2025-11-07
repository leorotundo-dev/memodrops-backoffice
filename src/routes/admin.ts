/**
 * Rotas administrativas
 * 
 * Endpoints para operações administrativas como limpeza de dados
 */

import { Router } from 'express';
import { query } from '../db/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * POST /api/admin/cleanup
 * Limpa todos os dados de teste do banco de dados
 */
router.post('/cleanup', async (req, res) => {
  try {
    console.log('[Admin] Iniciando limpeza de dados de teste...');
    
    // Ler script de limpeza
    const cleanupScript = fs.readFileSync(
      path.join(__dirname, '../../migrations/002_cleanup_test_data.sql'),
      'utf-8'
    );
    
    // Executar limpeza
    await query(cleanupScript);
    
    console.log('[Admin] ✅ Limpeza concluída com sucesso!');
    
    res.json({
      success: true,
      message: 'Dados de teste removidos com sucesso',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[Admin] Erro ao limpar dados:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/stats
 * Retorna estatísticas do banco de dados
 */
router.get('/stats', async (req, res) => {
  try {
    const stats: any = {};
    
    // Contar harvest_items
    const harvestResult = await query('SELECT COUNT(*) as count FROM harvest_items');
    stats.harvest_items = parseInt(harvestResult.rows[0].count);
    
    // Contar contests (se existir)
    try {
      const contestsResult = await query('SELECT COUNT(*) as count FROM contests');
      stats.contests = parseInt(contestsResult.rows[0].count);
    } catch (err) {
      stats.contests = 0;
    }
    
    // Contar subjects (se existir)
    try {
      const subjectsResult = await query('SELECT COUNT(*) as count FROM subjects');
      stats.subjects = parseInt(subjectsResult.rows[0].count);
    } catch (err) {
      stats.subjects = 0;
    }
    
    // Contar topics (se existir)
    try {
      const topicsResult = await query('SELECT COUNT(*) as count FROM topics');
      stats.topics = parseInt(topicsResult.rows[0].count);
    } catch (err) {
      stats.topics = 0;
    }
    
    // Contar drops (se existir)
    try {
      const dropsResult = await query('SELECT COUNT(*) as count FROM drops');
      stats.drops = parseInt(dropsResult.rows[0].count);
    } catch (err) {
      stats.drops = 0;
    }
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[Admin] Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
