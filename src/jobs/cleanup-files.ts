/**
 * Job de Limpeza Automática de Arquivos
 * Remove PDFs órfãos (sem edital associado) e arquivos muito antigos
 */

import { query } from '../db/index.js';
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = '/data/uploads';
const MAX_AGE_DAYS = 90; // Arquivos sem edital associado por mais de 90 dias são removidos

interface CleanupStats {
  orphanedFiles: number;
  oldFiles: number;
  totalRemoved: number;
  spaceSaved: number; // bytes
}

/**
 * Remove arquivos órfãos (não associados a nenhum edital)
 */
async function cleanupOrphanedFiles(): Promise<CleanupStats> {
  const stats: CleanupStats = {
    orphanedFiles: 0,
    oldFiles: 0,
    totalRemoved: 0,
    spaceSaved: 0,
  };

  try {
    // Verificar se diretório existe
    if (!fs.existsSync(UPLOADS_DIR)) {
      console.log('[Cleanup] Diretório de uploads não existe');
      return stats;
    }

    // Listar todos os arquivos
    const files = fs.readdirSync(UPLOADS_DIR);
    console.log(`[Cleanup] Encontrados ${files.length} arquivos`);

    // Buscar todos os PDFs associados a editais
    const result = await query(`
      SELECT DISTINCT pdf_url
      FROM editals
      WHERE pdf_url IS NOT NULL
    `);

    const activePdfs = new Set(
      result.rows.map(row => {
        const url = row.pdf_url as string;
        return path.basename(url);
      })
    );

    console.log(`[Cleanup] ${activePdfs.size} PDFs ativos no banco`);

    // Verificar cada arquivo
    for (const file of files) {
      const filePath = path.join(UPLOADS_DIR, file);
      const fileStat = fs.statSync(filePath);

      // Pular diretórios
      if (fileStat.isDirectory()) continue;

      // Verificar se arquivo está associado a um edital
      const isActive = activePdfs.has(file);

      if (!isActive) {
        // Arquivo órfão - verificar idade
        const ageInDays = (Date.now() - fileStat.mtimeMs) / (1000 * 60 * 60 * 24);

        if (ageInDays > MAX_AGE_DAYS) {
          // Remover arquivo antigo
          console.log(`[Cleanup] Removendo arquivo órfão antigo: ${file} (${Math.round(ageInDays)} dias)`);
          fs.unlinkSync(filePath);
          stats.orphanedFiles++;
          stats.totalRemoved++;
          stats.spaceSaved += fileStat.size;
        } else {
          console.log(`[Cleanup] Mantendo arquivo órfão recente: ${file} (${Math.round(ageInDays)} dias)`);
        }
      }
    }

    console.log(`[Cleanup] Limpeza concluída:`, stats);
    return stats;
  } catch (error) {
    console.error('[Cleanup] Erro ao limpar arquivos:', error);
    throw error;
  }
}

/**
 * Executa limpeza completa
 */
export async function runCleanup(): Promise<CleanupStats> {
  console.log('[Cleanup] Iniciando limpeza de arquivos...');
  const stats = await cleanupOrphanedFiles();
  
  const spaceSavedMB = (stats.spaceSaved / (1024 * 1024)).toFixed(2);
  console.log(`[Cleanup] Removidos ${stats.totalRemoved} arquivos, ${spaceSavedMB} MB liberados`);
  
  return stats;
}

// Executar limpeza a cada 24 horas
if (process.env.NODE_ENV === 'production') {
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas
  
  setInterval(async () => {
    try {
      await runCleanup();
    } catch (error) {
      console.error('[Cleanup] Erro ao executar limpeza agendada:', error);
    }
  }, CLEANUP_INTERVAL);
  
  console.log('[Cleanup] Job de limpeza agendado (a cada 24h)');
}
