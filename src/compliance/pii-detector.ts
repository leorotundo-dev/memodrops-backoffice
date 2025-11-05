// src/compliance/pii-detector.ts
export interface PIIMatch {
  type: 'cpf' | 'email' | 'phone' | 'rg' | 'name' | 'address';
  value: string;
  position: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface PIIDetectionResult {
  hasPII: boolean;
  matches: PIIMatch[];
  summary: string;
}

export function detectPII(text: string): PIIDetectionResult {
  const matches: PIIMatch[] = [];
  
  // CPF
  const cpfRegex = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
  let match;
  while ((match = cpfRegex.exec(text)) !== null) {
    matches.push({
      type: 'cpf',
      value: match[0],
      position: match.index,
      confidence: 'high',
    });
  }
  
  // Email
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  while ((match = emailRegex.exec(text)) !== null) {
    matches.push({
      type: 'email',
      value: match[0],
      position: match.index,
      confidence: 'high',
    });
  }
  
  // Telefone
  const phoneRegex = /\b(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b/g;
  while ((match = phoneRegex.exec(text)) !== null) {
    matches.push({
      type: 'phone',
      value: match[0],
      position: match.index,
      confidence: 'medium',
    });
  }
  
  return {
    hasPII: matches.length > 0,
    matches,
    summary: matches.length > 0 
      ? `Encontrados ${matches.length} possíveis dados pessoais` 
      : 'Nenhum dado pessoal detectado',
  };
}
