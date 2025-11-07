/**
 * Parser de Seções Estruturadas de Editais
 * 
 * Extrai informações específicas (datas, vagas, salários) de texto
 */

export interface ParsedEdital {
  dates: {
    publication?: Date;
    registration_start?: Date;
    registration_end?: Date;
    exam_date?: Date;
    result_date?: Date;
  };
  vacancies: {
    cargo: string;
    quantity: number;
    type: 'efetivo' | 'temporario' | 'cadastro_reserva';
    salary?: string;
    education_level?: string;
    requirements?: string[];
  }[];
  registration: {
    fee?: string;
    exemption?: boolean;
    link?: string;
  };
  exam_stages: {
    type: string;
    weight?: number;
    eliminatory?: boolean;
  }[];
}

/**
 * Faz parse completo de um edital
 */
export function parseEdital(fullText: string, sections: Record<string, string>): ParsedEdital {
  return {
    dates: parseDates(fullText),
    vacancies: parseVacancies(sections.vagas || fullText),
    registration: parseRegistration(sections.inscricoes || fullText),
    exam_stages: parseExamStages(sections.provas || fullText)
  };
}

/**
 * Extrai datas do texto
 */
function parseDates(text: string): ParsedEdital['dates'] {
  const dates: ParsedEdital['dates'] = {};
  
  // Padrões de data
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g,  // DD/MM/YYYY
    /(\d{1,2}) de (\w+) de (\d{4})/gi          // DD de MMMM de YYYY
  ];
  
  const monthNames: Record<string, number> = {
    'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3,
    'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7,
    'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
  };
  
  // Buscar data de publicação
  const pubMatch = text.match(/(?:publicado|publicação).*?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
  if (pubMatch) {
    dates.publication = new Date(parseInt(pubMatch[3]), parseInt(pubMatch[2]) - 1, parseInt(pubMatch[1]));
  }
  
  // Buscar período de inscrições
  const inscMatch = text.match(/inscri[çc][õo]es?.*?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}).*?(?:a|até).*?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
  if (inscMatch) {
    dates.registration_start = new Date(parseInt(inscMatch[3]), parseInt(inscMatch[2]) - 1, parseInt(inscMatch[1]));
    dates.registration_end = new Date(parseInt(inscMatch[6]), parseInt(inscMatch[5]) - 1, parseInt(inscMatch[4]));
  }
  
  // Buscar data da prova
  const provaMatch = text.match(/(?:prova|exame).*?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
  if (provaMatch) {
    dates.exam_date = new Date(parseInt(provaMatch[3]), parseInt(provaMatch[2]) - 1, parseInt(provaMatch[1]));
  }
  
  return dates;
}

/**
 * Extrai informações de vagas
 */
function parseVacancies(text: string): ParsedEdital['vacancies'] {
  const vacancies: ParsedEdital['vacancies'] = [];
  
  // Padrão: Cargo + quantidade + salário
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Tentar extrair cargo
    const cargoMatch = line.match(/([A-ZÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜ][a-zàáâãäåçèéêëìíîïñòóôõöùúûü\s\-]+?)[\s\-]+(\d+)\s*vaga/i);
    
    if (cargoMatch) {
      const cargo = cargoMatch[1].trim();
      const quantity = parseInt(cargoMatch[2]);
      
      // Tentar extrair salário
      const salaryMatch = line.match(/R\$\s*([\d.,]+)/);
      const salary = salaryMatch ? `R$ ${salaryMatch[1]}` : undefined;
      
      // Tentar extrair escolaridade
      let education_level: string | undefined;
      if (/superior/i.test(line)) education_level = 'superior';
      else if (/m[ée]dio/i.test(line)) education_level = 'médio';
      else if (/fundamental/i.test(line)) education_level = 'fundamental';
      
      // Determinar tipo
      let type: 'efetivo' | 'temporario' | 'cadastro_reserva' = 'efetivo';
      if (/cadastro.{0,10}reserva/i.test(line)) type = 'cadastro_reserva';
      else if (/tempor[aá]rio/i.test(line)) type = 'temporario';
      
      vacancies.push({
        cargo,
        quantity,
        type,
        salary,
        education_level
      });
    }
  }
  
  // Se não encontrou vagas estruturadas, tentar buscar número total
  if (vacancies.length === 0) {
    const totalMatch = text.match(/(\d+)\s*vagas?/i);
    if (totalMatch) {
      vacancies.push({
        cargo: 'Não especificado',
        quantity: parseInt(totalMatch[1]),
        type: 'efetivo'
      });
    }
  }
  
  return vacancies;
}

/**
 * Extrai informações de inscrição
 */
function parseRegistration(text: string): ParsedEdital['registration'] {
  const registration: ParsedEdital['registration'] = {};
  
  // Taxa de inscrição
  const feeMatch = text.match(/taxa.*?R\$\s*([\d.,]+)/i);
  if (feeMatch) {
    registration.fee = `R$ ${feeMatch[1]}`;
  }
  
  // Isenção
  registration.exemption = /isen[çc][ãa]o/i.test(text);
  
  // Link de inscrição
  const linkMatch = text.match(/(https?:\/\/[^\s]+)/);
  if (linkMatch) {
    registration.link = linkMatch[1];
  }
  
  return registration;
}

/**
 * Extrai etapas do exame
 */
function parseExamStages(text: string): ParsedEdital['exam_stages'] {
  const stages: ParsedEdital['exam_stages'] = [];
  
  // Prova objetiva
  if (/objetiva/i.test(text)) {
    stages.push({
      type: 'objetiva',
      eliminatory: /eliminat[óo]ria/i.test(text)
    });
  }
  
  // Prova discursiva
  if (/discursiva/i.test(text)) {
    stages.push({
      type: 'discursiva',
      eliminatory: /eliminat[óo]ria/i.test(text)
    });
  }
  
  // Prova prática
  if (/pr[aá]tica/i.test(text)) {
    stages.push({
      type: 'pratica',
      eliminatory: /eliminat[óo]ria/i.test(text)
    });
  }
  
  // Títulos
  if (/t[íi]tulos/i.test(text)) {
    stages.push({
      type: 'titulos',
      eliminatory: false
    });
  }
  
  return stages;
}

/**
 * Extrai salário de texto
 */
export function extractSalary(text: string): string | null {
  const patterns = [
    /R\$\s*([\d.,]+)/,
    /remunera[çc][ãa]o.*?([\d.,]+)/i,
    /sal[aá]rio.*?([\d.,]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return `R$ ${match[1]}`;
    }
  }
  
  return null;
}

/**
 * Extrai localização de texto
 */
export function extractLocation(text: string): string | null {
  // UFs brasileiras
  const ufs = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  
  // Buscar cidade - UF
  for (const uf of ufs) {
    const pattern = new RegExp(`([A-ZÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜ][a-zàáâãäåçèéêëìíîïñòóôõöùúûü\\s]+)\\s*[-–—]?\\s*${uf}\\b`, 'i');
    const match = text.match(pattern);
    if (match) {
      return `${match[1].trim()} - ${uf}`;
    }
  }
  
  // Buscar apenas UF
  for (const uf of ufs) {
    if (new RegExp(`\\b${uf}\\b`).test(text)) {
      return uf;
    }
  }
  
  return null;
}
