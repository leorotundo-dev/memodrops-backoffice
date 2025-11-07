/**
 * Sistema de Verificação de Veracidade de Dados
 * 
 * Valida e atribui scores de confiança aos dados extraídos
 */

export interface VerificationResult {
  field: string;
  value: any;
  is_valid: boolean;
  confidence: number; // 0-1
  issues: string[];
  suggestions?: string[];
}

export interface DataVerificationReport {
  overall_confidence: number;
  verified_fields: number;
  total_fields: number;
  issues_found: number;
  results: VerificationResult[];
  needs_manual_review: boolean;
}

/**
 * Verifica todos os dados de um edital
 */
export function verifyEditalData(data: any): DataVerificationReport {
  const results: VerificationResult[] = [];
  
  // Verificar cada campo
  results.push(verifyTitle(data.title));
  results.push(verifyInstitution(data.institution));
  results.push(verifyDates(data));
  results.push(verifyVacancies(data.vacancies));
  results.push(verifySalary(data.salary));
  results.push(verifyLocation(data.location));
  results.push(verifyEducationLevel(data.education_level));
  results.push(verifySubjects(data.subjects));
  
  // Calcular métricas gerais
  const validResults = results.filter(r => r.is_valid);
  const overallConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  const issuesCount = results.reduce((sum, r) => sum + r.issues.length, 0);
  
  // Determinar se precisa revisão manual
  const needsReview = overallConfidence < 0.7 || issuesCount > 3;
  
  return {
    overall_confidence: overallConfidence,
    verified_fields: validResults.length,
    total_fields: results.length,
    issues_found: issuesCount,
    results,
    needs_manual_review: needsReview
  };
}

/**
 * Verifica título do concurso
 */
function verifyTitle(title: string): VerificationResult {
  const issues: string[] = [];
  let confidence = 1.0;
  
  if (!title || title.trim().length === 0) {
    issues.push('Título vazio');
    confidence = 0;
  } else if (title.length < 10) {
    issues.push('Título muito curto');
    confidence = 0.5;
  } else if (title.length > 200) {
    issues.push('Título muito longo');
    confidence = 0.7;
  }
  
  // Verificar se tem palavras-chave esperadas
  const keywords = ['concurso', 'seleção', 'processo seletivo', 'edital'];
  const hasKeyword = keywords.some(k => title.toLowerCase().includes(k));
  
  if (!hasKeyword) {
    issues.push('Título não contém palavras-chave esperadas');
    confidence *= 0.8;
  }
  
  return {
    field: 'title',
    value: title,
    is_valid: issues.length === 0,
    confidence,
    issues
  };
}

/**
 * Verifica instituição/órgão
 */
function verifyInstitution(institution: string): VerificationResult {
  const issues: string[] = [];
  let confidence = 1.0;
  
  if (!institution || institution.trim().length === 0) {
    issues.push('Instituição não informada');
    confidence = 0;
  } else if (institution.length < 3) {
    issues.push('Nome da instituição muito curto');
    confidence = 0.5;
  }
  
  return {
    field: 'institution',
    value: institution,
    is_valid: issues.length === 0,
    confidence,
    issues
  };
}

/**
 * Verifica datas
 */
function verifyDates(data: any): VerificationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let confidence = 1.0;
  
  const dates = {
    registration_start: data.registration_start,
    registration_end: data.registration_end,
    exam_date: data.exam_date
  };
  
  // Verificar se datas são válidas
  for (const [key, value] of Object.entries(dates)) {
    if (value) {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        issues.push(`Data inválida: ${key}`);
        confidence *= 0.7;
      } else {
        // Verificar se data está no passado
        const now = new Date();
        if (date < now && key !== 'registration_start') {
          suggestions.push(`Data ${key} está no passado`);
          confidence *= 0.9;
        }
      }
    }
  }
  
  // Verificar ordem lógica das datas
  if (dates.registration_start && dates.registration_end) {
    const start = new Date(dates.registration_start);
    const end = new Date(dates.registration_end);
    
    if (start > end) {
      issues.push('Data de início das inscrições posterior ao fim');
      confidence *= 0.5;
    }
  }
  
  if (dates.registration_end && dates.exam_date) {
    const regEnd = new Date(dates.registration_end);
    const exam = new Date(dates.exam_date);
    
    if (regEnd > exam) {
      issues.push('Data da prova anterior ao fim das inscrições');
      confidence *= 0.5;
    }
  }
  
  return {
    field: 'dates',
    value: dates,
    is_valid: issues.length === 0,
    confidence,
    issues,
    suggestions
  };
}

/**
 * Verifica número de vagas
 */
function verifyVacancies(vacancies: any): VerificationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let confidence = 1.0;
  
  if (vacancies === null || vacancies === undefined) {
    suggestions.push('Número de vagas não informado');
    confidence = 0.5;
  } else {
    const num = parseInt(vacancies);
    
    if (isNaN(num)) {
      issues.push('Número de vagas inválido');
      confidence = 0;
    } else if (num < 0) {
      issues.push('Número de vagas negativo');
      confidence = 0;
    } else if (num === 0) {
      suggestions.push('Número de vagas é zero (cadastro de reserva?)');
      confidence = 0.8;
    } else if (num > 10000) {
      suggestions.push('Número de vagas muito alto (verificar)');
      confidence = 0.7;
    }
  }
  
  return {
    field: 'vacancies',
    value: vacancies,
    is_valid: issues.length === 0,
    confidence,
    issues,
    suggestions
  };
}

/**
 * Verifica salário
 */
function verifySalary(salary: any): VerificationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let confidence = 1.0;
  
  if (!salary) {
    suggestions.push('Salário não informado');
    confidence = 0.5;
  } else {
    const salaryStr = String(salary);
    
    // Tentar extrair valor numérico
    const match = salaryStr.match(/[\d.,]+/);
    if (match) {
      const value = parseFloat(match[0].replace(/\./g, '').replace(',', '.'));
      
      if (value < 1000) {
        suggestions.push('Salário muito baixo (verificar)');
        confidence = 0.7;
      } else if (value > 50000) {
        suggestions.push('Salário muito alto (verificar)');
        confidence = 0.8;
      }
    } else {
      issues.push('Formato de salário não reconhecido');
      confidence = 0.6;
    }
  }
  
  return {
    field: 'salary',
    value: salary,
    is_valid: issues.length === 0,
    confidence,
    issues,
    suggestions
  };
}

/**
 * Verifica localização
 */
function verifyLocation(location: string): VerificationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let confidence = 1.0;
  
  if (!location) {
    suggestions.push('Localização não informada');
    confidence = 0.5;
  } else if (location.length < 3) {
    issues.push('Localização muito curta');
    confidence = 0.5;
  } else {
    // Verificar se tem UF (2 letras maiúsculas)
    const hasUF = /[A-Z]{2}/.test(location);
    if (!hasUF) {
      suggestions.push('Localização sem UF identificável');
      confidence = 0.8;
    }
  }
  
  return {
    field: 'location',
    value: location,
    is_valid: issues.length === 0,
    confidence,
    issues,
    suggestions
  };
}

/**
 * Verifica nível de escolaridade
 */
function verifyEducationLevel(level: string): VerificationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let confidence = 1.0;
  
  const validLevels = ['fundamental', 'médio', 'medio', 'superior', 'pós-graduação', 'pos-graduacao'];
  
  if (!level) {
    suggestions.push('Nível de escolaridade não informado');
    confidence = 0.5;
  } else if (!validLevels.some(v => level.toLowerCase().includes(v))) {
    issues.push('Nível de escolaridade não reconhecido');
    confidence = 0.6;
  }
  
  return {
    field: 'education_level',
    value: level,
    is_valid: issues.length === 0,
    confidence,
    issues,
    suggestions
  };
}

/**
 * Verifica matérias (CRÍTICO)
 */
function verifySubjects(subjects: any[]): VerificationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let confidence = 1.0;
  
  if (!subjects || !Array.isArray(subjects)) {
    issues.push('⚠️ CRÍTICO: Matérias não encontradas');
    confidence = 0;
  } else if (subjects.length === 0) {
    issues.push('⚠️ CRÍTICO: Nenhuma matéria extraída');
    confidence = 0;
  } else {
    // Verificar quantidade
    if (subjects.length < 3) {
      suggestions.push('Poucas matérias encontradas (esperado 5+)');
      confidence = 0.6;
    } else if (subjects.length > 30) {
      suggestions.push('Muitas matérias encontradas (verificar duplicatas)');
      confidence = 0.8;
    }
    
    // Verificar se tem matérias básicas comuns
    const basicSubjects = ['português', 'matemática', 'informatica'];
    const hasBasic = subjects.some(s => 
      basicSubjects.some(b => s.name?.toLowerCase().includes(b))
    );
    
    if (!hasBasic) {
      suggestions.push('Nenhuma matéria básica identificada');
      confidence *= 0.9;
    }
    
    // Verificar confiança individual das matérias
    const avgSubjectConfidence = subjects.reduce((sum, s) => sum + (s.confidence || 0), 0) / subjects.length;
    confidence *= avgSubjectConfidence;
  }
  
  return {
    field: 'subjects',
    value: subjects,
    is_valid: issues.length === 0,
    confidence,
    issues,
    suggestions
  };
}
