/**
 * Scheduler Interno - MemoDrops Harvester
 * 
 * Executa jobs periódicos usando node-cron
 * Roda dentro do próprio servidor (não depende de cron externo)
 */

import cron from 'node-cron';
import { runAll } from './jobs/harvest.js';
import { processHarvestItems } from './jobs/process-content.js';

console.log('📅 Inicializando scheduler...');

/**
 * Job 1: Coleta de Editais (Harvest)
 * Executa a cada 6 horas
 * Horários: 00:00, 06:00, 12:00, 18:00
 */
cron.schedule('0 */6 * * *', async () => {
  console.log('\n⏰ [Scheduler] Iniciando coleta de editais...');
  try {
    await runAll();
    console.log('✅ [Scheduler] Coleta concluída com sucesso');
  } catch (error) {
    console.error('❌ [Scheduler] Erro na coleta:', error);
  }
}, {
  timezone: "America/Sao_Paulo"
});

/**
 * Job 2: Processamento de Conteúdo (IA)
 * Executa a cada hora
 */
cron.schedule('0 * * * *', async () => {
  console.log('\n⏰ [Scheduler] Iniciando processamento de conteúdo...');
  try {
    await processHarvestItems();
    console.log('✅ [Scheduler] Processamento concluído com sucesso');
  } catch (error) {
    console.error('❌ [Scheduler] Erro no processamento:', error);
  }
}, {
  timezone: "America/Sao_Paulo"
});

console.log('✅ Scheduler configurado com sucesso!');
console.log('📋 Jobs agendados:');
console.log('   - Coleta de editais: a cada 6 horas (00:00, 06:00, 12:00, 18:00)');
console.log('   - Processamento (IA): a cada hora');
console.log('   - Timezone: America/Sao_Paulo');

/**
 * Função para executar coleta inicial
 */
export async function runInitialHarvest() {
  console.log('\n🚀 Executando coleta inicial...');
  try {
    await runAll();
    console.log('✅ Coleta inicial concluída!');
  } catch (error) {
    console.error('❌ Erro na coleta inicial:', error);
  }
}
