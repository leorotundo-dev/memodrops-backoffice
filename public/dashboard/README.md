# MemoDrops – Discovery Dashboard (Zero-build)
Dashboard estático (HTML+JS) para observar **fontes**, **coleta** e **gaps por IC**.
Data: 2025-11-05

## Como usar
1. Abra `config.js` e ajuste:
   - `HARVESTER_BASE_URL`: URL do serviço Harvester (ex.: https://<seu>.railway.app)
   - `IC_ENGINE_BASE_URL`: URL do IC Engine / API Core
2. Sirva os arquivos estáticos (qualquer CDN/host) ou abra `index.html` no navegador.
   - Dica: `npx serve .` ou `python3 -m http.server`

## Tabs
- **Visão geral**: KPIs (novos, erros, licenças), linha diária (novos/dedup/erros)
- **Fontes**: catálogo (requer endpoint opcional `/discover/sources`)
- **Gaps por IC**: subtemas com IC alto e baixa cobertura (requer `/coverage/gaps`)
- **Itens recentes**: últimos itens do Harvester (`/admin/harvest/items`)

## Endpoints esperados
- Harvester:
  - `GET /admin/harvest/items`
  - (opcional) `GET /discover/sources`
- IC/Backend:
  - `GET /coverage/gaps?window=12m&subject=dir_const` (ou equivalente)
  - (opcional) `GET /ic?...`

## Nota
Se os endpoints não existirem, o dashboard mostra mensagens que explicam como expor cada rota.
