/**
 * Analisador automático de conteúdo de editais
 * Extrai informações estruturadas do texto
 */

export interface EditalAnalysis {
  vacancies?: number;
  salary?: string;
  location?: string;
  education_level?: string;
  exam_date?: string;
  registration_start?: string;
  registration_end?: string;
  positions?: string[];
}

/**
 * Analisa texto de edital e extrai informações estruturadas
 */
export function analyzeEdital(text: string): EditalAnalysis {
  if (!text) return {};
  
  const analysis: EditalAnalysis = {};
  
  // Extrair número de vagas
  const vagasMatch = text.match(/(\d+)\s*(?:vaga|vagas)/i);
  if (vagasMatch) {
    analysis.vacancies = parseInt(vagasMatch[1]);
  }
  
  // Extrair salário
  const salarioMatch = text.match(/(?:sal[áa]rio|remunera[çc][ãa]o|vencimento)[\s:]*R\$\s*([\d.,]+)/i);
  if (salarioMatch) {
    analysis.salary = `R$ ${salarioMatch[1]}`;
  }
  
  // Extrair local
  const localPatterns = [
    /(?:local|cidade|munic[íi]pio)[\s:]*([A-ZÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜ][a-zàáâãäåçèéêëìíîïñòóôõöùúûü\s-]+(?:\/[A-Z]{2})?)/i,
    /([A-ZÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜ][a-zàáâãäåçèéêëìíîïñòóôõöùúûü\s-]+)\s*[-–]\s*[A-Z]{2}/,
  ];
  
  for (const pattern of localPatterns) {
    const match = text.match(pattern);
    if (match) {
      analysis.location = match[1].trim();
      break;
    }
  }
  
  // Extrair nível de escolaridade
  const nivelPatterns = [
    { pattern: /ensino\s+superior|n[íi]vel\s+superior|gradua[çc][ãa]o/i, level: 'superior' },
    { pattern: /ensino\s+m[ée]dio|n[íi]vel\s+m[ée]dio/i, level: 'médio' },
    { pattern: /ensino\s+fundamental|n[íi]vel\s+fundamental/i, level: 'fundamental' },
    { pattern: /p[óo]s[-\s]gradua[çc][ãa]o|mestrado|doutorado/i, level: 'pós-graduação' },
  ];
  
  for (const { pattern, level } of nivelPatterns) {
    if (pattern.test(text)) {
      analysis.education_level = level;
      break;
    }
  }
  
  // Extrair data da prova
  const provaMatch = text.match(/(?:prova|exame)[\s:]*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (provaMatch) {
    analysis.exam_date = provaMatch[1];
  }
  
  // Extrair período de inscrição
  const inscricaoInicioMatch = text.match(/(?:inscri[çc][õo]es?|inscri[çc][ãa]o)[\s\w]*(?:de|a partir de)[\s:]*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (inscricaoInicioMatch) {
    analysis.registration_start = inscricaoInicioMatch[1];
  }
  
  const inscricaoFimMatch = text.match(/(?:inscri[çc][õo]es?|inscri[çc][ãa]o)[\s\w]*(?:at[ée]|encerram)[\s:]*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (inscricaoFimMatch) {
    analysis.registration_end = inscricaoFimMatch[1];
  }
  
  // Extrair cargos/posições
  const cargosSection = text.match(/(?:cargos?|fun[çc][õo]es?)[\s:]*([^\n]{0,500})/i);
  if (cargosSection) {
    const cargosText = cargosSection[1];
    // Tentar extrair lista de cargos
    const cargosList = cargosText.match(/[A-ZÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜ][a-zàáâãäåçèéêëìíîïñòóôõöùúûü\s]+(?:,|;|e|\n)/g);
    if (cargosList) {
      analysis.positions = cargosList.map(c => c.replace(/[,;e\n]/g, '').trim()).filter(c => c.length > 3);
    }
  }
  
  return analysis;
}

/**
 * Atualiza concurso com informações extraídas do edital
 */
export function mergeAnalysisToContest(existingContest: any, analysis: EditalAnalysis): any {
  return {
    ...existingContest,
    vacancies: analysis.vacancies || existingContest.vacancies,
    salary: analysis.salary || existingContest.salary,
    location: analysis.location || existingContest.location,
    education_level: analysis.education_level || existingContest.education_level,
    exam_date: analysis.exam_date || existingContest.exam_date,
    registration_start: analysis.registration_start || existingContest.registration_start,
    registration_end: analysis.registration_end || existingContest.registration_end,
  };
}
