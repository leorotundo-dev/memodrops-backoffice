/**
 * Extrator Completo de Conteúdo de Editais
 * 
 * Busca e extrai TODO o conteúdo textual de editais de concursos
 * sem depender de PDFs - apenas HTML/texto
 */

import * as cheerio from 'cheerio';
import { fetchHTML } from '../adapters/fetch.js';

export interface EditalContent {
  full_text: string;
  sections: {
    [key: string]: string;
  };
  links: {
    type: string;
    url: string;
    text: string;
  }[];
  confidence: number;
}

/**
 * Extrai conteúdo completo de um edital a partir de URL
 */
export async function extractEditalContent(url: string): Promise<EditalContent> {
  console.log(`[Extractor] Extraindo conteúdo de: ${url}`);
  
  try {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);
    
    // Remover scripts, styles, etc
    $('script, style, nav, header, footer, aside, .menu, .sidebar').remove();
    
    // Extrair texto completo
    const fullText = $('body').text()
      .replace(/\s+/g, ' ')
      .trim();
    
    // Identificar e extrair seções
    const sections = extractSections($, fullText);
    
    // Extrair links importantes
    const links = extractImportantLinks($, url);
    
    // Calcular confiança baseado na quantidade de conteúdo
    const confidence = calculateContentConfidence(fullText, sections);
    
    console.log(`[Extractor] Extraído: ${fullText.length} chars, ${Object.keys(sections).length} seções`);
    
    return {
      full_text: fullText,
      sections,
      links,
      confidence
    };
    
  } catch (error) {
    console.error(`[Extractor] Erro ao extrair ${url}:`, error);
    throw error;
  }
}

/**
 * Extrai seções específicas do edital
 */
function extractSections($: cheerio.CheerioAPI, fullText: string): Record<string, string> {
  const sections: Record<string, string> = {};
  
  // Padrões de seções comuns
  const sectionPatterns = [
    { key: 'conteudo_programatico', patterns: [
      /CONTEÚDO PROGRAMÁTICO/i,
      /CONHECIMENTOS EXIGIDOS/i,
      /PROGRAMA DAS PROVAS/i,
      /DISCIPLINAS/i
    ]},
    { key: 'inscricoes', patterns: [
      /DAS INSCRIÇÕES/i,
      /INSCRIÇÃO/i
    ]},
    { key: 'vagas', patterns: [
      /DAS VAGAS/i,
      /CARGOS E VAGAS/i,
      /QUADRO DE VAGAS/i
    ]},
    { key: 'provas', patterns: [
      /DAS PROVAS/i,
      /EXAMES/i,
      /AVALIAÇÃO/i
    ]},
    { key: 'cronograma', patterns: [
      /CRONOGRAMA/i,
      /CALENDÁRIO/i
    ]},
    { key: 'requisitos', patterns: [
      /REQUISITOS/i,
      /QUALIFICAÇÕES/i
    ]}
  ];
  
  // Tentar extrair cada seção
  for (const { key, patterns } of sectionPatterns) {
    for (const pattern of patterns) {
      const match = fullText.match(new RegExp(
        `(${pattern.source})([\\s\\S]{0,5000}?)(?=(?:CAPÍTULO|ANEXO|\\d+\\.|$))`,
        'i'
      ));
      
      if (match && match[2]) {
        sections[key] = match[2].trim();
        break;
      }
    }
  }
  
  // Tentar extrair de elementos HTML estruturados
  $('h1, h2, h3, h4').each((_, el) => {
    const $heading = $(el);
    const title = $heading.text().trim();
    
    for (const { key, patterns } of sectionPatterns) {
      if (patterns.some(p => p.test(title))) {
        let content = '';
        let $next = $heading.next();
        
        // Coletar conteúdo até próximo heading
        while ($next.length && !$next.is('h1, h2, h3, h4')) {
          content += $next.text() + ' ';
          $next = $next.next();
        }
        
        if (content.trim().length > sections[key]?.length || 0) {
          sections[key] = content.trim();
        }
      }
    }
  });
  
  return sections;
}

/**
 * Extrai links importantes (anexos, retificações, etc)
 */
function extractImportantLinks($: cheerio.CheerioAPI, baseUrl: string): Array<{type: string, url: string, text: string}> {
  const links: Array<{type: string, url: string, text: string}> = [];
  
  $('a').each((_, el) => {
    const $link = $(el);
    const href = $link.attr('href');
    const text = $link.text().trim();
    
    if (!href || !text) return;
    
    const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
    
    // Identificar tipo de link
    let type = 'other';
    
    if (/retifica|errata/i.test(text)) {
      type = 'retificacao';
    } else if (/anexo/i.test(text)) {
      type = 'anexo';
    } else if (/edital/i.test(text)) {
      type = 'edital';
    } else if (/programa|conteúdo/i.test(text)) {
      type = 'conteudo_programatico';
    }
    
    if (type !== 'other') {
      links.push({ type, url: fullUrl, text });
    }
  });
  
  return links;
}

/**
 * Calcula confiança do conteúdo extraído
 */
function calculateContentConfidence(fullText: string, sections: Record<string, string>): number {
  let confidence = 0.5; // Base
  
  // Bonus por quantidade de texto
  if (fullText.length > 5000) confidence += 0.1;
  if (fullText.length > 10000) confidence += 0.1;
  
  // Bonus por seções encontradas
  const criticalSections = ['conteudo_programatico', 'vagas', 'inscricoes'];
  const foundCritical = criticalSections.filter(s => sections[s]).length;
  confidence += (foundCritical / criticalSections.length) * 0.3;
  
  return Math.min(confidence, 1.0);
}

/**
 * Busca conteúdo programático em links relacionados
 */
export async function findAndExtractProgramatico(mainUrl: string): Promise<string | null> {
  try {
    const html = await fetchHTML(mainUrl);
    const $ = cheerio.load(html);
    
    // Buscar links para conteúdo programático
    const programaticoLinks: string[] = [];
    
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text();
      
      if (href && /programa|conteúdo|disciplina|matéria/i.test(text)) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, mainUrl).href;
        programaticoLinks.push(fullUrl);
      }
    });
    
    // Tentar extrair de cada link
    for (const link of programaticoLinks) {
      try {
        console.log(`[Extractor] Buscando conteúdo programático em: ${link}`);
        const content = await extractEditalContent(link);
        
        if (content.sections.conteudo_programatico) {
          return content.sections.conteudo_programatico;
        }
      } catch (err) {
        console.error(`[Extractor] Erro ao buscar ${link}:`, err);
      }
    }
    
    return null;
  } catch (error) {
    console.error('[Extractor] Erro ao buscar conteúdo programático:', error);
    return null;
  }
}
