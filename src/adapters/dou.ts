// src/adapters/dou.ts
import { fetchHTML } from './fetch.js';

export async function harvestDOU(): Promise<{url:string, html:string}[]> {
  const list = [
    'https://www.in.gov.br/leiturajornal', // ponto de entrada (exemplo)
  ];
  const out: {url:string, html:string}[] = [];
  for (const u of list){
    const html = await fetchHTML(u);
    out.push({ url: u, html });
  }
  return out;
}
