// src/server.ts
import express from 'express';
import cron from 'node-cron';
import { runAll } from './jobs/harvest.js';
import { processHarvestItems } from './jobs/process-content.js';
import { query } from './db/index.js';
import { calculateIC, getTopicGaps } from './ic-engine/calculator.js';
import { setupRouter } from './setup-endpoint.js';
import { autoSetupDatabase } from './db/auto-setup.js';
import hierarchyRouter from './routes/hierarchy.js';
import editalRouter from './routes/edital.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
// Serve static files from public directory
const publicPath = process.env.NODE_ENV === 'production' ? 'dist/public' : 'public';
app.use(express.static(publicPath));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'memodrops-backoffice' });
});

// Setup endpoints
app.use(setupRouter);

// Hierarchy endpoints
app.use(hierarchyRouter);

// Edital endpoints
console.log('[DEBUG] Registering edital router...');
app.use(editalRouter);
console.log('[DEBUG] Edital router registered');

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
  } catch (error) {
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
  } catch (error) {
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
    const params: any[] = [];
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
    params.push(parseInt(limit as string), parseInt(offset as string));
    
    const result = await query(sql, params);
    
    res.json({
      items: result.rows,
      total: result.rows.length,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
    
    const ic = await calculateIC(topic as string, subject as string);
    res.json({ topic, subject, ic });
  } catch (error) {
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
    
    const gaps = await getTopicGaps(
      subject as string,
      parseFloat(minIC as string)
    );
    
    res.json({ gaps });
  } catch (error) {
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
  } catch (error) {
    console.error('[API] Erro ao listar fontes:', error);
    res.status(500).json({ error: 'Erro ao listar fontes' });
  }
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, async () => {
  console.log('========================================');
  console.log('🚀 MemoDrops Backoffice');
  console.log('========================================');
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log('========================================');
  
  // Auto-setup database on first run
  await autoSetupDatabase();
  
  // Schedule daily harvest at 2 AM (low traffic time)
  cron.schedule('0 2 * * *', async () => {
    console.log('🕐 [CRON] Executando coleta agendada...');
    try {
      const result = await runAll();
      console.log('✅ [CRON] Coleta concluída:', result);
    } catch (error) {
      console.error('❌ [CRON] Erro na coleta:', error);
    }
  });
  
  console.log('⏰ Cron job configurado: coleta diária às 2h da manhã');
});
