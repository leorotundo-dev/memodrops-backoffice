/**
 * Utilitários para Formatação de Dados
 * 
 * Normaliza salários, datas e outros dados antes da ingestão no banco
 */

/**
 * Converte texto de salário para número
 * Exemplos:
 * - "R$ 6.400,00" -> 6400
 * - "até R$ 6,4 mil" -> 6400
 * - "R$ 10 mil" -> 10000
 * - "de R$ 3.000 a R$ 5.000" -> 5000 (pega o maior)
 */
export function normalizeSalary(salaryText: string | null | undefined): number | null {
  if (!salaryText) return null;
  
  const text = salaryText.toLowerCase().trim();
  
  // Remover "até", "de", "a partir de", etc
  const cleanText = text
    .replace(/até\s*/gi, '')
    .replace(/a partir de\s*/gi, '')
    .replace(/de\s*/gi, '')
    .replace(/a\s*/gi, '');
  
  // Padrão: "R$ X mil" ou "R$ X,Y mil"
  const milMatch = cleanText.match(/r\$?\s*([\d.,]+)\s*mil/i);
  if (milMatch) {
    const value = parseFloat(milMatch[1].replace(',', '.'));
    return Math.round(value * 1000);
  }
  
  // Padrão: "R$ X.XXX,XX" ou "R$ X.XXX"
  const normalMatch = cleanText.match(/r\$?\s*([\d.,]+)/i);
  if (normalMatch) {
    // Remove pontos de milhar e substitui vírgula por ponto
    const value = normalMatch[1]
      .replace(/\./g, '')
      .replace(',', '.');
    return Math.round(parseFloat(value));
  }
  
  return null;
}

/**
 * Converte texto de data em português para formato ISO (YYYY-MM-DD)
 * Exemplos:
 * - "22 de fevereiro de 2021" -> "2021-02-22"
 * - "15/03/2024" -> "2024-03-15"
 * - "01-12-2023" -> "2023-12-01"
 */
export function normalizeDate(dateText: string | null | undefined): string | null {
  if (!dateText) return null;
  
  const text = dateText.trim();
  
  // Mapeamento de meses em português
  const monthNames: Record<string, string> = {
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04',
    'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
    'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
  };
  
  // Padrão: "DD de MMMM de YYYY"
  const longMatch = text.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (longMatch) {
    const day = longMatch[1].padStart(2, '0');
    const month = monthNames[longMatch[2].toLowerCase()];
    const year = longMatch[3];
    
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }
  
  // Padrão: "DD/MM/YYYY" ou "DD-MM-YYYY"
  const shortMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (shortMatch) {
    const day = shortMatch[1].padStart(2, '0');
    const month = shortMatch[2].padStart(2, '0');
    const year = shortMatch[3];
    
    return `${year}-${month}-${day}`;
  }
  
  // Padrão: "YYYY-MM-DD" (já está no formato correto)
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return text;
  }
  
  return null;
}

/**
 * Valida se um texto parece ser um título de concurso válido
 * Filtra conteúdo irrelevante como "07 Vídeo clipes gravados no Castelo"
 */
export function isValidContestTitle(title: string): boolean {
  if (!title || title.length < 10) return false;
  
  // Lista de palavras-chave que indicam conteúdo irrelevante
  const invalidKeywords = [
    'vídeo', 'clipe', 'música', 'castelo', 'turismo', 'viagem',
    'receita', 'culinária', 'filme', 'série', 'novela', 'esporte',
    'futebol', 'jogo', 'entretenimento', 'celebridade', 'fofoca'
  ];
  
  const lowerTitle = title.toLowerCase();
  
  // Se contém palavras-chave inválidas, rejeitar
  for (const keyword of invalidKeywords) {
    if (lowerTitle.includes(keyword)) {
      return false;
    }
  }
  
  // Lista de palavras-chave que indicam conteúdo válido
  const validKeywords = [
    'concurso', 'edital', 'seleção', 'processo seletivo', 'vaga',
    'prefeitura', 'câmara', 'tribunal', 'ministério', 'secretaria',
    'governo', 'federal', 'estadual', 'municipal', 'público',
    'servidor', 'cargo', 'função', 'emprego', 'oportunidade'
  ];
  
  // Se contém pelo menos uma palavra-chave válida, aceitar
  for (const keyword of validKeywords) {
    if (lowerTitle.includes(keyword)) {
      return true;
    }
  }
  
  // Se não contém palavras-chave válidas nem inválidas, rejeitar por segurança
  return false;
}
