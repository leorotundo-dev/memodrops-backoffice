import crypto from 'crypto';

/**
 * Gera um hash SHA-256 de um objeto ou string
 * Usado para identificar conteúdo duplicado no cache de drops
 */
export function generateHash(data: any): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Gera um hash específico para cache de drops
 * Combina blueprint_id, subject_id e parâmetros de geração
 */
export function generateDropCacheHash(params: {
  blueprintId: number;
  subjectId?: number;
  dropType?: string;
  additionalContext?: string;
}): string {
  const { blueprintId, subjectId, dropType, additionalContext } = params;
  
  const cacheKey = {
    blueprint: blueprintId,
    subject: subjectId || 'general',
    type: dropType || 'default',
    context: additionalContext || ''
  };
  
  return generateHash(cacheKey);
}

/**
 * Verifica se dois hashes são iguais
 */
export function compareHashes(hash1: string, hash2: string): boolean {
  return hash1 === hash2;
}
