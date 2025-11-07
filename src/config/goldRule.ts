/**
 * Configuração da Gold Rule para priorização de tópicos
 * 
 * A Gold Rule determina quais tópicos devem receber mais atenção
 * na geração de drops com base em:
 * - Frequência de aparição em editais
 * - Peso/importância atribuída pela banca
 * - Dificuldade percebida
 */

export const GOLD_RULE_CONFIG = {
  /**
   * Threshold mínimo de prioridade para gerar drops
   * Tópicos com prioridade abaixo deste valor são ignorados
   */
  PRIORITY_THRESHOLD: 0.7,

  /**
   * Número máximo de drops por tópico
   */
  MAX_DROPS_PER_TOPIC: 10,

  /**
   * Número mínimo de drops por tópico de alta prioridade
   */
  MIN_DROPS_HIGH_PRIORITY: 5,

  /**
   * Peso para frequência de aparição
   */
  FREQUENCY_WEIGHT: 0.4,

  /**
   * Peso para importância atribuída pela banca
   */
  IMPORTANCE_WEIGHT: 0.4,

  /**
   * Peso para dificuldade
   */
  DIFFICULTY_WEIGHT: 0.2,

  /**
   * Tipos de drops suportados
   */
  DROP_TYPES: [
    'fundamento',
    'regra_excecao',
    'pattern_banca',
    'exemplo_pratico',
    'pegadinha_comum',
    'mnemonic'
  ] as const,

  /**
   * Versão do prompt de geração de drops
   */
  PROMPT_VERSION: 'v1.0.0'
};

export type DropType = typeof GOLD_RULE_CONFIG.DROP_TYPES[number];

/**
 * Calcula a prioridade de um tópico com base nos pesos configurados
 */
export function calculateTopicPriority(
  frequency: number,
  importance: number,
  difficulty: number
): number {
  const { FREQUENCY_WEIGHT, IMPORTANCE_WEIGHT, DIFFICULTY_WEIGHT } = GOLD_RULE_CONFIG;
  
  return (
    frequency * FREQUENCY_WEIGHT +
    importance * IMPORTANCE_WEIGHT +
    difficulty * DIFFICULTY_WEIGHT
  );
}

/**
 * Determina se um tópico deve receber drops com base na prioridade
 */
export function shouldGenerateDrops(priority: number): boolean {
  return priority >= GOLD_RULE_CONFIG.PRIORITY_THRESHOLD;
}

/**
 * Calcula o número de drops a gerar para um tópico
 */
export function calculateDropCount(priority: number): number {
  const { MAX_DROPS_PER_TOPIC, MIN_DROPS_HIGH_PRIORITY, PRIORITY_THRESHOLD } = GOLD_RULE_CONFIG;
  
  if (priority < PRIORITY_THRESHOLD) {
    return 0;
  }
  
  // Mapeia prioridade (0.7-1.0) para quantidade de drops (5-10)
  const normalizedPriority = (priority - PRIORITY_THRESHOLD) / (1 - PRIORITY_THRESHOLD);
  const dropCount = Math.round(
    MIN_DROPS_HIGH_PRIORITY + normalizedPriority * (MAX_DROPS_PER_TOPIC - MIN_DROPS_HIGH_PRIORITY)
  );
  
  return Math.min(dropCount, MAX_DROPS_PER_TOPIC);
}
