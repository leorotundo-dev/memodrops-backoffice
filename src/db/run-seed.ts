// Script to seed initial data
import { pool } from './index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSeed() {
  try {
    console.log('🌱 Seeding database...');
    
    // Read and execute schema
    const schemaPath = path.join(__dirname, 'schema-hierarchy.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('📋 Creating tables...');
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      await pool.query(schema);
      console.log('✅ Tables created');
    }
    
    // Read and execute seed
    const seedPath = path.join(__dirname, 'seed-categories.sql');
    if (fs.existsSync(seedPath)) {
      console.log('🌱 Seeding categories...');
      const seed = fs.readFileSync(seedPath, 'utf-8');
      await pool.query(seed);
      console.log('✅ Categories seeded');
    }
    
    // Verify
    const result = await pool.query('SELECT COUNT(*) FROM categories');
    console.log(`✅ Total categories: ${result.rows[0].count}`);
    
    console.log('🎉 Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

runSeed();
