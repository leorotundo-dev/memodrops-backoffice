// auto-setup.ts
// Inicializa o banco automaticamente na primeira execução
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function autoSetupDatabase(): Promise<void> {
  try {
    console.log('🔍 Verificando se banco precisa ser inicializado...');
    
    // Tentar verificar se a tabela harvest_items existe
    try {
      await query(`SELECT 1 FROM harvest_items LIMIT 1`);
      console.log('✅ Banco já inicializado, continuando...');
      return;
    } catch (error) {
      console.log('📝 Banco não inicializado, criando tabelas...');
    }
    
    // Ler e executar schema
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    
    await query(schema);
    
    console.log('✅ Banco inicializado com sucesso!');
    
    // Verificar tabelas criadas
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📊 Tabelas criadas:');
    result.rows.forEach((row: any) => {
      console.log(`  - ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco:', error);
    console.error('⚠️ Servidor vai continuar, mas funcionalidades de banco não funcionarão');
  }
}
