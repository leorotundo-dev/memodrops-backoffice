// src/adapters/dou.ts
import * as cheerio from 'cheerio';
import { fetchHTML } from './fetch.js';
export async function harvestDOU() {
    console.log('[DOU] Iniciando coleta...');
    const items = [];
    try {
        const urls = [
            'https://www.in.gov.br/consulta',
            'https://www.in.gov.br/leiturajornal',
        ];
        for (const url of urls) {
            try {
                console.log(`[DOU] Buscando ${url}...`);
                const html = await fetchHTML(url);
                const $ = cheerio.load(html);
                // Buscar links de publicações
                $('a[href*="/web/dou"]').each((_, el) => {
                    const href = $(el).attr('href');
                    const title = $(el).text().trim();
                    if (href && title && title.length > 10) {
                        const fullUrl = href.startsWith('http') ? href : `https://www.in.gov.br${href}`;
                        if (!items.find(item => item.url === fullUrl)) {
                            items.push({
                                url: fullUrl,
                                title,
                                content: title,
                                meta: { fonte: 'DOU', tipo: 'publicacao' },
                            });
                        }
                    }
                });
                // Buscar PDFs
                $('a[href$=".pdf"]').each((_, el) => {
                    const href = $(el).attr('href');
                    const title = $(el).text().trim() || 'Publicação DOU';
                    if (href) {
                        const fullUrl = href.startsWith('http') ? href : `https://www.in.gov.br${href}`;
                        if (!items.find(item => item.url === fullUrl)) {
                            items.push({
                                url: fullUrl,
                                title,
                                content: `PDF: ${title}`,
                                meta: { fonte: 'DOU', tipo: 'pdf' },
                            });
                        }
                    }
                });
            }
            catch (err) {
                console.error(`[DOU] Erro ao processar ${url}:`, err);
            }
        }
        console.log(`[DOU] Coletados ${items.length} itens`);
        return items;
    }
    catch (error) {
        console.error('[DOU] Erro geral:', error);
        return items;
    }
}
