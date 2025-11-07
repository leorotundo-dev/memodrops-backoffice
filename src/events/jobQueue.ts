/**
 * Job Queue - Sistema de Eventos para Encadeamento de Jobs
 * 
 * Implementa um sistema de dependências onde cada job dispara
 * automaticamente o próximo quando há novos dados.
 * 
 * Fluxo:
 * Harvest (coleta) -> Process (IA) -> Generate (drops) -> Distribute
 */

import { EventEmitter } from 'events';
import { runAll as runHarvest } from '../jobs/harvest.js';
import { processHarvestItems } from '../jobs/process-content.js';

// Event Emitter global para comunicação entre jobs
export const jobQueue = new EventEmitter();

// Tipos de eventos
export const JobEvents = {
  HARVEST_COMPLETED: 'harvest:completed',
  PROCESS_COMPLETED: 'process:completed',
  GENERATE_COMPLETED: 'generate:completed',
  DISTRIBUTE_COMPLETED: 'distribute:completed',
};

// Interface para resultado de jobs
export interface JobResult {
  success: boolean;
  newItems?: number;
  totalItems?: number;
  message?: string;
  error?: any;
}

/**
 * Configura listeners para encadear jobs automaticamente
 */
export function setupJobQueue() {
  console.log('🔗 Configurando sistema de dependências entre jobs...');
  
  // Quando harvest completar com novos dados -> disparar processamento
  jobQueue.on(JobEvents.HARVEST_COMPLETED, async (result: JobResult) => {
    if (result.success && result.newItems && result.newItems > 0) {
      console.log(`\\n⚡ [JobQueue] Harvest coletou ${result.newItems} novos itens`);
      console.log('⚡ [JobQueue] Disparando processamento automático...');
      
      try {
        const processResult = await processHarvestItems();
        jobQueue.emit(JobEvents.PROCESS_COMPLETED, {
          success: true,
          message: 'Processamento concluído',
          ...processResult
        });
      } catch (error) {
        console.error('❌ [JobQueue] Erro no processamento:', error);
        jobQueue.emit(JobEvents.PROCESS_COMPLETED, {
          success: false,
          error
        });
      }
    } else {
      console.log('\\n⚡ [JobQueue] Harvest não encontrou novos itens, pulando processamento');
    }
  });
  
  // Quando processamento completar -> disparar geração de drops
  jobQueue.on(JobEvents.PROCESS_COMPLETED, async (result: JobResult) => {
    if (result.success) {
      console.log('\\n⚡ [JobQueue] Processamento concluído');
      console.log('⚡ [JobQueue] Geração de drops será implementada em breve');
      
      // TODO: Implementar geração de drops
      // const generateResult = await generateDrops();
      // jobQueue.emit(JobEvents.GENERATE_COMPLETED, generateResult);
    }
  });
  
  // Quando geração completar -> disparar distribuição
  jobQueue.on(JobEvents.GENERATE_COMPLETED, async (result: JobResult) => {
    if (result.success) {
      console.log('\\n⚡ [JobQueue] Geração de drops concluída');
      console.log('⚡ [JobQueue] Distribuição será implementada em breve');
      
      // TODO: Implementar distribuição
      // const distributeResult = await distributeDrops();
      // jobQueue.emit(JobEvents.DISTRIBUTE_COMPLETED, distributeResult);
    }
  });
  
  console.log('✅ Sistema de dependências configurado!');
  console.log('📋 Fluxo: Harvest -> Process -> Generate -> Distribute');
}

/**
 * Executa coleta e dispara processamento em cadeia
 */
export async function runHarvestWithChain(): Promise<JobResult> {
  console.log('\\n🚀 Executando coleta com processamento em cadeia...');
  
  try {
    const result = await runHarvest();
    
    const jobResult: JobResult = {
      success: true,
      newItems: result.new || 0,
      totalItems: result.total || 0,
      message: `Coleta concluída: ${result.new} novos, ${result.total} total`
    };
    
    // Emitir evento para disparar próximo job
    jobQueue.emit(JobEvents.HARVEST_COMPLETED, jobResult);
    
    return jobResult;
  } catch (error) {
    console.error('❌ Erro na coleta:', error);
    
    const jobResult: JobResult = {
      success: false,
      error
    };
    
    jobQueue.emit(JobEvents.HARVEST_COMPLETED, jobResult);
    
    return jobResult;
  }
}
