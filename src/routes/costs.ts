/**
 * API de Custos Operacionais
 */

import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

interface CostMetrics {
  openai: {
    tokensUsed: number;
    estimatedCost: number;
    model: string;
  };
  railway: {
    plan: string;
    monthlyLimit: number;
    currentUsage: number;
  };
  storage: {
    database: number; // MB
    files: number; // MB
    limit: number; // MB
  };
  monthly: {
    total: number;
    breakdown: Array<{
      category: string;
      amount: number;
      percentage: number;
    }>;
  };
}

/**
 * GET /api/costs/metrics
 * Retorna métricas de custo em tempo real
 */
router.get('/metrics', async (req, res) => {
  try {
    // Calcular custos de OpenAI baseado em itens processados
    const processedResult = await query(`
      SELECT COUNT(*) as count
      FROM harvest_items
      WHERE status = 'processed'
    `);
    
    const processedCount = parseInt(processedResult.rows[0]?.count || '0');
    
    // Estimativa: 800 tokens/item com gpt-4.1-nano
    const tokensPerItem = 800;
    const totalTokens = processedCount * tokensPerItem;
    
    // Custo: $0.03/1M input + $0.12/1M output (assumindo 75% input, 25% output)
    const inputTokens = totalTokens * 0.75;
    const outputTokens = totalTokens * 0.25;
    const costUSD = (inputTokens / 1000000 * 0.03) + (outputTokens / 1000000 * 0.12);
    const costBRL = costUSD * 5.50; // Conversão USD → BRL
    
    // Obter tamanho do banco de dados
    const dbSizeResult = await query(`
      SELECT pg_database_size(current_database()) as size
    `);
    const dbSizeMB = parseInt(dbSizeResult.rows[0]?.size || '0') / (1024 * 1024);
    
    // Calcular uso do volume de uploads
    const fs = require('fs');
    const path = require('path');
    let uploadsSizeMB = 0;
    
    try {
      const uploadsDir = '/data/uploads';
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        let totalBytes = 0;
        
        for (const file of files) {
          const filePath = path.join(uploadsDir, file);
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            totalBytes += stats.size;
          }
        }
        
        uploadsSizeMB = totalBytes / (1024 * 1024);
      }
    } catch (e) {
      console.error('[Costs] Erro ao calcular tamanho do volume:', e);
      uploadsSizeMB = 0;
    }
    
    // Plano Railway (exemplo - ajustar conforme seu plano real)
    const railwayPlan = process.env.RAILWAY_PLAN || 'Hobby';
    const railwayMonthlyLimit = railwayPlan === 'Hobby' ? 5 : 20; // USD
    const railwayCurrentUsage = 2.50; // Estimativa - Railway não expõe via API
    
    // Calcular breakdown mensal
    const openaiCost = costBRL;
    const railwayCost = railwayCurrentUsage * 5.50; // USD → BRL
    const totalCost = openaiCost + railwayCost;
    
    const metrics: CostMetrics = {
      openai: {
        tokensUsed: totalTokens,
        estimatedCost: openaiCost,
        model: 'gpt-4.1-nano',
      },
      railway: {
        plan: railwayPlan,
        monthlyLimit: railwayMonthlyLimit * 5.50, // USD → BRL
        currentUsage: railwayCost,
      },
      storage: {
        database: Math.round(dbSizeMB * 100) / 100,
        files: Math.round(uploadsSizeMB * 100) / 100,
        limit: 5120, // 5GB limite para volume
      },
      monthly: {
        total: Math.round(totalCost * 100) / 100,
        breakdown: [
          {
            category: 'OpenAI API',
            amount: Math.round(openaiCost * 100) / 100,
            percentage: Math.round((openaiCost / totalCost) * 100),
          },
          {
            category: 'Railway Hosting',
            amount: Math.round(railwayCost * 100) / 100,
            percentage: Math.round((railwayCost / totalCost) * 100),
          },
        ],
      },
    };
    
    res.json(metrics);
  } catch (error) {
    console.error('[Costs] Erro ao obter métricas:', error);
    res.status(500).json({ error: 'Erro ao obter métricas de custo' });
  }
});

/**
 * GET /api/costs/history
 * Retorna histórico de custos dos últimos 30 dias
 */
router.get('/history', async (req, res) => {
  try {
    // Buscar itens processados por dia nos últimos 30 dias
    const historyResult = await query(`
      SELECT 
        DATE(processed_at) as date,
        COUNT(*) as count
      FROM harvest_items
      WHERE status = 'processed'
        AND processed_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(processed_at)
      ORDER BY date DESC
    `);
    
    const history = historyResult.rows.map(row => {
      const count = parseInt(row.count);
      const tokens = count * 800;
      const costUSD = (tokens * 0.75 / 1000000 * 0.03) + (tokens * 0.25 / 1000000 * 0.12);
      const costBRL = costUSD * 5.50;
      
      return {
        date: row.date,
        items: count,
        tokens: tokens,
        cost: Math.round(costBRL * 100) / 100,
      };
    });
    
    res.json(history);
  } catch (error) {
    console.error('[Costs] Erro ao obter histórico:', error);
    res.status(500).json({ error: 'Erro ao obter histórico de custos' });
  }
});

export default router;
