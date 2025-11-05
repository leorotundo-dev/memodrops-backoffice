// setup-endpoint.ts
// Endpoint para inicializar o banco via HTTP
import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query } from './db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const setupRouter = Router();

setupRouter.post('/admin/setup-database', async (req, res) => {
  try {
    console.log('🚀 Iniciando setup do banco de dados...');
    
    // Ler schema SQL
    const schemaPath = join(__dirname, 'db', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    
    console.log('📝 Criando tabelas...');
    
    // Executar schema (pode dar erro se já existir, mas tudo bem)
    try {
      await query(schema);
      console.log('✅ Tabelas criadas com sucesso!');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('ℹ️ Tabelas já existem, continuando...');
      } else {
        throw error;
      }
    }
    
    // Verificar tabelas
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const tables = result.rows.map((row: any) => row.table_name);
    console.log('📊 Tabelas disponíveis:', tables);
    
    res.json({
      success: true,
      message: 'Database setup completed successfully',
      tables: tables
    });
    
  } catch (error: any) {
    console.error('❌ Erro no setup:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Health check específico do banco
setupRouter.get('/admin/database-health', async (req, res) => {
  try {
    const result = await query('SELECT NOW() as current_time');
    
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    res.json({
      status: 'healthy',
      database: 'connected',
      current_time: result.rows[0].current_time,
      tables: tablesResult.rows.map((row: any) => row.table_name)
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
