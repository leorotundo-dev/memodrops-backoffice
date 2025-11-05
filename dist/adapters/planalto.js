// src/adapters/planalto.ts
import { fetchHTML } from './fetch.js';
export async function harvestPlanalto() {
    const list = [
        'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/lei/L14333.htm', // L. de Licitações (exemplo)
    ];
    const out = [];
    for (const u of list) {
        const html = await fetchHTML(u);
        out.push({ url: u, html });
    }
    return out;
}
