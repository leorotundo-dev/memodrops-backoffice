/**
 * Scheduler Interno - MemoDrops Harvester
 * 
 * Executa jobs periódicos usando node-cron
 * Roda dentro do próprio servidor (não depende de cron externo)
 * Usa sistema de eventos para encadear jobs automaticamente
 */

import cron from 'node-cron';
import { setupJobQueue, runHarvestWithChain } from './events/jobQueue.js';

console.log('📅 Inicializando scheduler...');

// Configurar sistema de dependências entre jobs
setupJobQueue();

/**
 * Job 1: Coleta de Editais (Harvest) com Processamento em Cadeia
 * Executa a cada 6 horas
 * Horários: 00:00, 06:00, 12:00, 18:00
 * 
 * Quando há novos dados, dispara automaticamente:
 * - Processamento com IA
 * - Geração de drops
 * - Distribuição
 */
cron.schedule('0 */6 * * *', async () => {
  console.log('\\n⏰ [Scheduler] Iniciando coleta de editais com processamento em cadeia...');
  try {
    await runHarvestWithChain();
    console.log('✅ [Scheduler] Coleta concluída (processamento em cadeia iniciado)');
  } catch (error) {
    console.error('❌ [Scheduler] Erro na coleta:', error);
  }
}, {
  timezone: "America/Sao_Paulo"
});

console.log('✅ Scheduler configurado com sucesso!');
console.log('📋 Jobs agendados:');
console.log('   - Coleta de editais: a cada 6 horas (00:00, 06:00, 12:00, 18:00)');
console.log('   - Processamento automático: quando há novos dados');
console.log('   - Timezone: America/Sao_Paulo');
console.log('🔗 Sistema de dependências ativo: Harvest -> Process -> Generate -> Distribute');

/**
 * Função para executar coleta inicial com processamento em cadeia
 */
export async function runInitialHarvest() {
  console.log('\\n🚀 Executando coleta inicial com processamento em cadeia...');
  try {
    await runHarvestWithChain();
    console.log('✅ Coleta inicial concluída (processamento em cadeia iniciado)!');
  } catch (error) {
    console.error('❌ Erro na coleta inicial:', error);
  }
}
