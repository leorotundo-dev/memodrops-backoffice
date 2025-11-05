// setup-db.js
// Script para inicializar o schema do PostgreSQL no Railway
// Executar: node setup-db.js

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

async function setupDatabase() {
  console.log('🚀 Iniciando setup do banco de dados...');
  
  // Conectar ao PostgreSQL
  const pool = new Pool({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    // Testar conexão
    const client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL');
    
    // Ler schema SQL
    const schemaPath = path.join(__dirname, 'src', 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Executar schema
    console.log('📝 Criando tabelas...');
    await client.query(schema);
    console.log('✅ Tabelas criadas com sucesso!');
    
    // Verificar tabelas
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('\n📊 Tabelas criadas:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    client.release();
    await pool.end();
    
    console.log('\n🎉 Setup concluído com sucesso!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro no setup:', error);
    await pool.end();
    process.exit(1);
  }
}

setupDatabase();
