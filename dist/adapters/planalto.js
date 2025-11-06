// src/adapters/planalto.ts
import * as cheerio from 'cheerio';
import { fetchHTML } from './fetch.js';
export async function harvestPlanalto() {
    console.log('[Planalto] Iniciando coleta...');
    const items = [];
    try {
        // URLs de listagem de legislação
        const urls = [
            'https://www.planalto.gov.br/ccivil_03/leis/leis_2024.htm',
            'https://www.planalto.gov.br/ccivil_03/leis/leis_2023.htm',
        ];
        for (const url of urls) {
            try {
                console.log(`[Planalto] Buscando ${url}...`);
                const html = await fetchHTML(url);
                const $ = cheerio.load(html);
                // Buscar links de leis
                $('a[href*="lei"], a[href*="Lei"]').each((_, el) => {
                    const href = $(el).attr('href');
                    const title = $(el).text().trim();
                    if (href && title && title.length > 5) {
                        const fullUrl = href.startsWith('http')
                            ? href
                            : `https://www.planalto.gov.br${href.startsWith('/') ? '' : '/ccivil_03/'}${href}`;
                        if (!items.find(item => item.url === fullUrl)) {
                            items.push({
                                url: fullUrl,
                                title,
                                content: title,
                                meta: { fonte: 'Planalto', tipo: 'lei' },
                            });
                        }
                    }
                });
            }
            catch (err) {
                console.error(`[Planalto] Erro ao processar ${url}:`, err);
            }
        }
        console.log(`[Planalto] Coletados ${items.length} itens`);
        return items;
    }
    catch (error) {
        console.error('[Planalto] Erro geral:', error);
        return items;
    }
}
