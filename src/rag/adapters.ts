import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ExtractedContent {
  title: string;
  content: string;
  metadata: Record<string, any>;
}

/**
 * Adapter base para fontes educacionais
 */
export abstract class EducationalSourceAdapter {
  abstract extract(url: string): Promise<ExtractedContent>;

  /**
   * Divide conteúdo em chunks menores
   */
  protected chunkContent(content: string, maxChunkSize: number = 1000): string[] {
    const chunks: string[] = [];
    const paragraphs = content.split('\n\n');
    
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  /**
   * Limpa texto removendo caracteres especiais
   */
  protected cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

/**
 * Adapter para Brasil Escola
 */
export class BrasilEscolaAdapter extends EducationalSourceAdapter {
  async extract(url: string): Promise<ExtractedContent> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);

      // Extrair título
      const title = $('h1.title, h1').first().text().trim();

      // Extrair conteúdo principal
      const contentElements = $('.content-text, .article-content, article p');
      let content = '';

      contentElements.each((_, el) => {
        const text = $(el).text().trim();
        if (text) {
          content += text + '\n\n';
        }
      });

      // Metadados
      const metadata = {
        source: 'Brasil Escola',
        url,
        author: $('meta[name="author"]').attr('content') || 'Brasil Escola',
        publishedDate: $('meta[property="article:published_time"]').attr('content')
      };

      return {
        title,
        content: this.cleanText(content),
        metadata
      };
    } catch (error: any) {
      throw new Error(`Erro ao extrair conteúdo do Brasil Escola: ${error.message}`);
    }
  }
}

/**
 * Adapter para Toda Matéria
 */
export class TodaMateriaAdapter extends EducationalSourceAdapter {
  async extract(url: string): Promise<ExtractedContent> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);

      // Extrair título
      const title = $('h1.entry-title, h1').first().text().trim();

      // Extrair conteúdo principal
      const contentElements = $('.entry-content p, .article-body p');
      let content = '';

      contentElements.each((_, el) => {
        const text = $(el).text().trim();
        if (text) {
          content += text + '\n\n';
        }
      });

      // Metadados
      const metadata = {
        source: 'Toda Matéria',
        url,
        author: $('meta[name="author"]').attr('content') || 'Toda Matéria',
        publishedDate: $('meta[property="article:published_time"]').attr('content')
      };

      return {
        title,
        content: this.cleanText(content),
        metadata
      };
    } catch (error: any) {
      throw new Error(`Erro ao extrair conteúdo do Toda Matéria: ${error.message}`);
    }
  }
}

/**
 * Adapter genérico para artigos web
 */
export class GenericArticleAdapter extends EducationalSourceAdapter {
  async extract(url: string): Promise<ExtractedContent> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);

      // Tentar extrair título de várias formas
      const title = 
        $('h1').first().text().trim() ||
        $('meta[property="og:title"]').attr('content') ||
        $('title').text().trim();

      // Tentar extrair conteúdo de várias formas
      let content = '';

      // Tentar seletores comuns de artigos
      const selectors = [
        'article p',
        '.article-content p',
        '.post-content p',
        '.entry-content p',
        'main p',
        '.content p'
      ];

      for (const selector of selectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          elements.each((_, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 50) { // Filtrar parágrafos muito curtos
              content += text + '\n\n';
            }
          });
          
          if (content.length > 200) break; // Se encontrou conteúdo suficiente, parar
        }
      }

      // Se não encontrou conteúdo, tentar extrair todo o texto
      if (!content) {
        content = $('body').text();
      }

      // Metadados
      const metadata = {
        source: 'Artigo Web',
        url,
        author: $('meta[name="author"]').attr('content') || 'Desconhecido',
        publishedDate: $('meta[property="article:published_time"]').attr('content')
      };

      return {
        title,
        content: this.cleanText(content),
        metadata
      };
    } catch (error: any) {
      throw new Error(`Erro ao extrair conteúdo do artigo: ${error.message}`);
    }
  }
}

/**
 * Factory para criar adapters baseado na URL
 */
export class AdapterFactory {
  static create(url: string): EducationalSourceAdapter {
    if (url.includes('brasilescola.uol.com.br')) {
      return new BrasilEscolaAdapter();
    } else if (url.includes('todamateria.com.br')) {
      return new TodaMateriaAdapter();
    } else {
      return new GenericArticleAdapter();
    }
  }
}
