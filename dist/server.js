// src/server.ts
import express from 'express';
import { runAll } from './jobs/harvest.js';
import { query } from './db/index.js';
import { calculateIC, getTopicGaps } from './ic-engine/calculator.js';
const app = express();
const PORT = process.env.PORT || 3001;
app.use(express.json());
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'memodrops-backoffice' });
});
// ============================================================================
// HARVESTER ADMIN ENDPOINTS
// ============================================================================
/**
 * GET /admin/harvest/items
 * Lista itens coletados pelo harvester
 */
app.get('/admin/harvest/items', async (req, res) => {
    try {
        const { source, status, limit = '50', offset = '0' } = req.query;
        let sql = 'SELECT * FROM harvest_items WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        if (source) {
            sql += ` AND source = $${paramIndex++}`;
            params.push(source);
        }
        if (status) {
            sql += ` AND status = $${paramIndex++}`;
            params.push(status);
        }
        sql += ` ORDER BY fetched_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), parseInt(offset));
        const result = await query(sql, params);
        res.json({
            items: result.rows,
            total: result.rows.length,
            limit: parseInt(limit),
            offset: parseInt(offset),
        });
    }
    catch (error) {
        console.error('[API] Erro ao listar itens:', error);
        res.status(500).json({ error: 'Erro ao listar itens' });
    }
});
/**
 * POST /admin/harvest/run
 * Executa coleta manual de todas as fontes
 */
app.post('/admin/harvest/run', async (req, res) => {
    try {
        const result = await runAll();
        res.json({ success: true, result });
    }
    catch (error) {
        console.error('[API] Erro ao executar coleta:', error);
        res.status(500).json({ error: 'Erro ao executar coleta' });
    }
});
/**
 * GET /admin/harvest/stats
 * Estatísticas do harvester
 */
app.get('/admin/harvest/stats', async (req, res) => {
    try {
        const totalResult = await query('SELECT COUNT(*) as total FROM harvest_items');
        const total = parseInt(totalResult.rows[0]?.total || '0');
        const bySourceResult = await query(`
      SELECT source, COUNT(*) as count 
      FROM harvest_items 
      GROUP BY source
    `);
        const byStatusResult = await query(`
      SELECT status, COUNT(*) as count 
      FROM harvest_items 
      GROUP BY status
    `);
        res.json({
            total,
            bySource: bySourceResult.rows,
            byStatus: byStatusResult.rows,
        });
    }
    catch (error) {
        console.error('[API] Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});
// ============================================================================
// IC ENGINE PUBLIC ENDPOINTS
// ============================================================================
/**
 * GET /api/ic/calculate
 * Calcula índice de cobrança de um tema
 */
app.get('/api/ic/calculate', async (req, res) => {
    try {
        const { topic, subject } = req.query;
        if (!topic) {
            return res.status(400).json({ error: 'Parâmetro "topic" é obrigatório' });
        }
        const ic = await calculateIC(topic, subject);
        res.json({ topic, subject, ic });
    }
    catch (error) {
        console.error('[API] Erro ao calcular IC:', error);
        res.status(500).json({ error: 'Erro ao calcular IC' });
    }
});
/**
 * GET /api/ic/gaps
 * Identifica temas importantes sem cards suficientes
 */
app.get('/api/ic/gaps', async (req, res) => {
    try {
        const { subject, minIC = '7' } = req.query;
        const gaps = await getTopicGaps(subject, parseFloat(minIC));
        res.json({ gaps });
    }
    catch (error) {
        console.error('[API] Erro ao buscar gaps:', error);
        res.status(500).json({ error: 'Erro ao buscar gaps' });
    }
});
/**
 * GET /discover/sources
 * Lista fontes disponíveis
 */
app.get('/discover/sources', async (req, res) => {
    try {
        const result = await query(`
      SELECT 
        source,
        COUNT(*) as total_items,
        MAX(fetched_at) as last_fetch
      FROM harvest_items
      GROUP BY source
      ORDER BY source
    `);
        res.json({ sources: result.rows });
    }
    catch (error) {
        console.error('[API] Erro ao listar fontes:', error);
        res.status(500).json({ error: 'Erro ao listar fontes' });
    }
});
// ============================================================================
// START SERVER
// ============================================================================
app.listen(PORT, () => {
    console.log('========================================');
    console.log('🚀 MemoDrops Backoffice');
    console.log('========================================');
    console.log(`Server: http://localhost:${PORT}`);
    console.log(`Health: http://localhost:${PORT}/health`);
    console.log('========================================');
});
