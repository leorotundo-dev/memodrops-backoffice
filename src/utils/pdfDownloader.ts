import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
}

/**
 * Faz download de um PDF e salva no diretório de uploads
 */
export async function downloadPDF(url: string, customName?: string): Promise<DownloadResult> {
  try {
    console.log(`[PDF Download] Iniciando download: ${url}`);
    
    // Validar URL
    if (!url || !url.startsWith('http')) {
      return { success: false, error: 'URL inválida' };
    }
    
    // Fazer download
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000, // 60 segundos
      maxContentLength: 50 * 1024 * 1024, // 50MB max
      headers: {
        'User-Agent': 'MemoDropsBot/1.0 (+https://memodrops.com)',
      },
    });
    
    // Verificar se é PDF
    const contentType = response.headers['content-type'];
    if (!contentType?.includes('pdf') && !url.toLowerCase().endsWith('.pdf')) {
      console.warn(`[PDF Download] Conteúdo pode não ser PDF: ${contentType}`);
    }
    
    // Gerar nome do arquivo
    const hash = crypto.createHash('md5').update(url).digest('hex');
    const fileName = customName 
      ? `${customName.replace(/[^a-z0-9-]/gi, '_')}_${hash.substring(0, 8)}.pdf`
      : `edital_${hash}.pdf`;
    
    const filePath = path.join(UPLOAD_DIR, fileName);
    
    // Criar diretório se não existir
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    
    // Salvar arquivo
    fs.writeFileSync(filePath, response.data);
    
    const fileSize = fs.statSync(filePath).size;
    
    console.log(`[PDF Download] ✅ Salvo: ${fileName} (${(fileSize / 1024).toFixed(2)} KB)`);
    
    return {
      success: true,
      filePath,
      fileName,
      fileSize,
    };
  } catch (error: any) {
    console.error(`[PDF Download] ❌ Erro ao baixar ${url}:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Detecta se uma URL aponta para um PDF
 */
export function isPDFUrl(url: string): boolean {
  if (!url) return false;
  
  const urlLower = url.toLowerCase();
  
  // Extensão .pdf
  if (urlLower.endsWith('.pdf')) return true;
  
  // Padrões comuns de URLs de editais
  if (urlLower.includes('edital') && urlLower.includes('.pdf')) return true;
  if (urlLower.includes('/midias/file/')) return true;
  if (urlLower.includes('/arquivos/') && urlLower.includes('pdf')) return true;
  
  return false;
}

/**
 * Extrai nome do edital da URL ou título
 */
export function extractEditalName(url: string, title?: string): string {
  if (title) {
    // Limpar título
    return title
      .replace(/edital\s+n[º°]?\s*/i, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }
  
  // Tentar extrair do URL
  const match = url.match(/([^/]+)\.pdf$/i);
  if (match) {
    return match[1].substring(0, 50);
  }
  
  return 'edital';
}
