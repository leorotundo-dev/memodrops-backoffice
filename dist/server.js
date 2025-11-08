// src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import logger from './utils/logger.js';
import { runAll } from './jobs/harvest.js';
import { processHarvestItems } from './jobs/process-content.js';
import { runCleanup } from './jobs/cleanup-files.js';
import { query } from './db/index.js';
import { calculateIC, getTopicGaps } from './ic-engine/calculator.js';
import { setupRouter } from './setup-endpoint.js';
import { autoSetupDatabase } from './db/auto-setup.js';
import hierarchyRouter from './routes/hierarchy.js';
import harvesterRouter from './routes/harvester.js';
import dropsRouter from './routes/drops.js';
import adminRouter from './routes/admin.js';
import costsRouter from './routes/costs.js';
import institutionsRouter from './routes/institutions.js';
import migrateRouter from './routes/migrate.js';
import cleanupRouter from './routes/cleanup.js';
import processRouter from './routes/process.js';
import errorsRouter from './routes/errors.js';
import processV2Router from './routes/process-v2.js';
import testV2Router from './routes/test-v2.js';
import processV3Router from './routes/process-v3.js';
import healthRouter from './routes/health.js';
import personalizationRouter from './routes/personalization.js';
import qaRouter from './routes/qa.js';
import pedagogyRouter from './routes/pedagogy.js';
import ragRouter from './routes/rag.js';
import adminMigrationsRouter from './routes/admin-migrations.js';
// Criar diretório para uploads se não existir
// Usar /data/uploads para persistência via Railway Volume
const uploadsDir = process.env.UPLOAD_DIR || (process.env.NODE_ENV === 'production' ? '/data/uploads' : './uploads');
// Iniciar job de limpeza automática
if (process.env.NODE_ENV === 'production') {
    // Executar limpeza inicial após 5 minutos
    setTimeout(() => {
        runCleanup().catch(err => console.error('[Cleanup] Erro na limpeza inicial:', err));
    }, 5 * 60 * 1000);
    // Agendar limpeza diária
    setInterval(() => {
        runCleanup().catch(err => console.error('[Cleanup] Erro na limpeza agendada:', err));
    }, 24 * 60 * 60 * 1000);
    console.log('✅ Job de limpeza automática agendado (a cada 24h)');
}
try {
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log(`✅ Created uploads directory: ${uploadsDir}`);
    }
    else {
        console.log(`✅ Uploads directory already exists: ${uploadsDir}`);
    }
}
catch (err) {
    console.error(`⚠️ Erro ao criar diretório de uploads: ${uploadsDir}`, err);
    console.log('⚠️ Continuando sem diretório de uploads...');
}
const app = express();
const PORT = process.env.PORT || 3001;
// Segurança: CORS
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// Segurança: Helmet (headers de segurança)
app.use(helmet({
    contentSecurityPolicy: false, // Desabilitar CSP para permitir dashboard
    crossOriginEmbedderPolicy: false
}));
// Segurança: Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Limite de 100 requisições por IP
    message: 'Muitas requisições deste IP, tente novamente em 15 minutos',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);
app.use(express.json());
// Ping endpoint PRIMEIRO - sem dependências
// Health check para Railway (sem /api)
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
app.get('/api/ping', (req, res) => {
    res.json({ pong: true, timestamp: new Date().toISOString() });
});
// Health check (detailed)
app.use(healthRouter);
// Serve static files from public directory
const publicPath = process.env.NODE_ENV === 'production' ? 'dist/public' : 'public';
try {
    app.use(express.static(publicPath));
}
catch (err) {
    console.error('[Static] Erro ao servir arquivos estáticos:', err);
}
// Dashboard route - serve index.html for /dashboard and /dashboard/
app.get(['/dashboard', '/dashboard/'], (req, res) => {
    const dashboardPath = process.env.NODE_ENV === 'production'
        ? 'dist/public/dashboard/index.html'
        : 'public/dashboard/index.html';
    res.sendFile(dashboardPath, { root: '.' });
});
// Root route - redirect to dashboard
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});
// Setup endpoints
app.use(setupRouter);
// Hierarchy endpoints
app.use(hierarchyRouter);
// Harvester endpoints
console.log('[DEBUG] Registering harvester router...');
app.use(harvesterRouter);
console.log('[DEBUG] Harvester router registered');
// Drops endpoints
console.log('[DEBUG] Registering drops router...');
app.use(dropsRouter);
console.log('[DEBUG] Drops router registered');
// Admin endpoints
console.log('[DEBUG] Registering admin router...');
app.use('/api/admin', adminRouter);
app.use('/api/costs', costsRouter);
console.log('[DEBUG] Admin router registered');
// Cleanup endpoints
app.use(cleanupRouter);
// Process endpoints
app.use(processRouter);
// Errors analysis endpoints
app.use(errorsRouter);
// Process V2 endpoints (sem PDFs)
app.use(processV2Router);
// Personalization endpoints
app.use(personalizationRouter);
// QA and Metrics endpoints
app.use(qaRouter);
// Pedagogy endpoints
app.use(pedagogyRouter);
// RAG endpoints
app.use(ragRouter);
// Admin migrations endpoints
app.use(adminMigrationsRouter);
// Test V2 endpoints
app.use(testV2Router);
// Process V3 endpoints (com microserviços)
app.use(processV3Router);
// Institutions endpoints
console.log('[DEBUG] Registering institutions router...');
app.use('/api/institutions', institutionsRouter);
console.log('[DEBUG] Institutions router registered');
// Migration endpoints
console.log('[DEBUG] Registering migrate router...');
app.use('/api/migrate', migrateRouter);
console.log('[DEBUG] Migrate router registered');
// Drop tables endpoint (DANGER - development only)
app.post('/admin/drop-tables', async (req, res) => {
    try {
        console.log('[DROP] Dropping all tables...');
        await query('DROP TABLE IF EXISTS subtopics CASCADE');
        await query('DROP TABLE IF EXISTS topics CASCADE');
        await query('DROP TABLE IF EXISTS subjects CASCADE');
        await query('DROP TABLE IF EXISTS editals CASCADE');
        await query('DROP TABLE IF EXISTS contests CASCADE');
        await query('DROP TABLE IF EXISTS categories CASCADE');
        console.log('[DROP] All tables dropped');
        res.json({ success: true, message: 'All tables dropped' });
    }
    catch (error) {
        console.error('[DROP] Error:', error);
        res.status(500).json({ error: 'Failed to drop tables' });
    }
});
// Seed endpoint (development only)
app.post('/admin/seed', async (req, res) => {
    try {
        console.log('[SEED] Starting database seed...');
        // Create tables
        await query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        icon VARCHAR(10),
        description TEXT,
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS contests (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        slug VARCHAR(500) UNIQUE NOT NULL,
        institution VARCHAR(255),
        exam_date DATE,
        vacancies INTEGER,
        salary DECIMAL(10,2),
        education_level VARCHAR(100),
        location VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        source_url TEXT,
        is_official BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS editals (
        id SERIAL PRIMARY KEY,
        contest_id INTEGER REFERENCES contests(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        edital_number VARCHAR(100),
        file_url TEXT,
        original_text TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        edital_id INTEGER REFERENCES editals(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        weight INTEGER DEFAULT 1,
        difficulty INTEGER DEFAULT 2,
        priority INTEGER DEFAULT 5,
        color VARCHAR(7),
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS topics (
        id SERIAL PRIMARY KEY,
        subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        description TEXT,
        difficulty INTEGER DEFAULT 2,
        priority INTEGER DEFAULT 5,
        estimated_concepts INTEGER DEFAULT 10,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS subtopics (
        id SERIAL PRIMARY KEY,
        topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        description TEXT,
        difficulty INTEGER DEFAULT 2,
        priority INTEGER DEFAULT 5,
        estimated_concepts INTEGER DEFAULT 5,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('[SEED] Tables created');
        // Seed categories
        await query(`
      INSERT INTO categories (name, slug, icon, description, display_order, is_active) VALUES
      ('Concursos Públicos', 'concursos-publicos', '🎯', 'Concursos públicos federais, estaduais e municipais', 1, true),
      ('ENEM', 'enem', '📚', 'Exame Nacional do Ensino Médio', 2, true),
      ('Vestibulares', 'vestibulares', '🎓', 'Vestibulares de universidades públicas e privadas', 3, true),
      ('Escola/Faculdade', 'escola-faculdade', '📖', 'Conteúdo escolar e acadêmico', 4, true),
      ('Certificações', 'certificacoes', '💼', 'Certificações profissionais e técnicas', 5, true),
      ('Outros', 'outros', '🌍', 'Outros objetivos de estudo', 6, true)
      ON CONFLICT (slug) DO NOTHING
    `);
        console.log('[SEED] Categories seeded');
        const result = await query('SELECT COUNT(*) FROM categories');
        console.log(`[SEED] Total categories: ${result.rows[0].count}`);
        res.json({ success: true, message: 'Database seeded successfully', categories: parseInt(result.rows[0].count) });
    }
    catch (error) {
        console.error('[SEED] Error:', error);
        res.status(500).json({ error: 'Failed to seed database', details: error instanceof Error ? error.message : String(error) });
    }
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
 * POST /admin/harvest/process
 * Processa itens coletados e envia para MemoDrops
 */
app.post('/admin/harvest/process', async (req, res) => {
    try {
        const result = await processHarvestItems();
        res.json({ success: true, result });
    }
    catch (error) {
        console.error('[API] Erro ao processar itens:', error);
        res.status(500).json({ error: 'Erro ao processar itens' });
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
app.listen(PORT, async () => {
    logger.info('========================================');
    logger.info('🚀 MemoDrops Backoffice');
    logger.info('========================================');
    logger.info(`Server: http://localhost:${PORT}`);
    logger.info(`Health: http://localhost:${PORT}/health`);
    logger.info('========================================');
    // Auto-setup database on first run
    await autoSetupDatabase();
    // Inicializar scheduler interno
    logger.info('\n📅 Inicializando scheduler...');
    await import('./scheduler.js');
    // Executar coleta inicial após 10 segundos
    setTimeout(async () => {
        console.log('\n🎬 Executando coleta inicial...');
        try {
            const result = await runAll();
            console.log('✅ Coleta inicial concluída:', result);
        }
        catch (error) {
            console.error('❌ Erro na coleta inicial:', error);
        }
    }, 10000);
});
