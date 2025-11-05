// src/pipeline/normalize.ts
import * as cheerio from 'cheerio';
export function extractText(html) {
    const $ = cheerio.load(html || '');
    const title = ($('title').first().text() || '').trim();
    $('script,style,noscript').remove();
    const text = $('body').text().replace(/[\s\n\r\t]+/g, ' ').trim();
    return { title, text };
}
// very naive license inference
export function inferLicense(url, html) {
    const u = (url || '').toLowerCase();
    if (u.includes('planalto.gov.br') || u.includes('in.gov.br') || u.includes('diariooficial'))
        return 'public_domain';
    if (/creative\s*commons|cc-by|cc0/i.test(html))
        return 'creative_commons';
    return 'unknown';
}
// fake PII scan (placeholder): you will replace by real PII/regex scanner
export function scanPII(text) {
    const flags = [];
    if (/(cpf\s*\d{3}\.\d{3}\.\d{3}-\d{2})/i.test(text))
        flags.push('cpf');
    if (/(\b\d{2}\/\d{2}\/\d{4}\b)/.test(text) && /nome:\s*[A-Z]/i.test(text))
        flags.push('possible_personal_data');
    return flags;
}
