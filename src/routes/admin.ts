/**
 * Rotas administrativas
 * 
 * Endpoints para operações administrativas como limpeza de dados
 */

import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

/**
 * POST /api/admin/cleanup
 * Limpa todos os dados de teste do banco de dados
 */
router.post('/cleanup', async (req, res) => {
  try {
    console.log('[Admin] Iniciando limpeza de dados de teste...');
    
    // SQL de limpeza inline
    const cleanupSQL = `
      -- Limpar tabela de itens coletados (harvest_items)
      TRUNCATE TABLE harvest_items CASCADE;
      
      -- Limpar tabela de contests (se existir)
      DO $$ 
      BEGIN
          IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'contests') THEN
              TRUNCATE TABLE contests CASCADE;
          END IF;
      END $$;
      
      -- Limpar tabela de subjects (se existir)
      DO $$ 
      BEGIN
          IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subjects') THEN
              TRUNCATE TABLE subjects CASCADE;
          END IF;
      END $$;
      
      -- Limpar tabela de topics (se existir)
      DO $$ 
      BEGIN
          IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'topics') THEN
              TRUNCATE TABLE topics CASCADE;
          END IF;
      END $$;
      
      -- Limpar tabela de drops (se existir)
      DO $$ 
      BEGIN
          IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'drops') THEN
              TRUNCATE TABLE drops CASCADE;
          END IF;
      END $$;
      
      -- Limpar tabela de user_drops (se existir)
      DO $$ 
      BEGIN
          IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_drops') THEN
              TRUNCATE TABLE user_drops CASCADE;
          END IF;
      END $$;
    `;
    
    // Executar limpeza
    await query(cleanupSQL);
    
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
