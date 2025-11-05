# MemoDrops Backoffice

Sistema de coleta de provas de concursos e cálculo de índice de cobrança (IC).

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────┐
│   BACKOFFICE (Sistema Separado)        │
│                                         │
│  ┌──────────────┐                      │
│  │  HARVESTER   │ ← Scraping automático│
│  │              │   FGV, CESPE, etc.   │
│  └──────┬───────┘                      │
│         │                               │
│         ↓ PostgreSQL                    │
│  ┌──────────────┐                      │
│  │  IC ENGINE   │ ← Calcula frequência │
│  │              │   de temas           │
│  └──────┬───────┘                      │
│         │                               │
│         ↓ APIs Públicas                 │
└─────────────────┬───────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│   MEMODROPS (App Principal)             │
│   - Consome IC scores via API           │
│   - Prioriza cards com IC alto          │
└─────────────────────────────────────────┘
```

## 📦 Componentes

### 1. Harvester (Coletor)
- Scraping automático de provas de concursos
- Fontes: FGV, CESPE/CEBRASPE, Planalto, DOU
- Deduplicação por hash SHA-256
- Detecção de PII (dados pessoais)
- Inferência de licenças

### 2. IC Engine (Índice de Cobrança)
- Calcula frequência de temas nas provas
- IC normalizado de 0 a 10
- Identifica gaps (temas importantes sem cards)
- APIs públicas para consulta

### 3. APIs Públicas

#### Admin Endpoints (Harvester)
- `GET /admin/harvest/items` - Lista itens coletados
- `POST /admin/harvest/run` - Executa coleta manual
- `GET /admin/harvest/stats` - Estatísticas

#### Public Endpoints (IC Engine)
- `GET /api/ic/calculate?topic=X&subject=Y` - Calcula IC de um tema
- `GET /api/ic/gaps?subject=X&minIC=7` - Identifica gaps
- `GET /discover/sources` - Lista fontes disponíveis

## 🚀 Deploy no Railway

### 1. Criar Banco PostgreSQL
```bash
railway add --plugin postgresql
```

### 2. Configurar Variáveis de Ambiente
```
PGHOST=<railway_postgres_host>
PGPORT=5432
PGDATABASE=railway
PGUSER=postgres
PGPASSWORD=<railway_postgres_password>
PORT=3001
```

### 3. Inicializar Schema
```bash
railway run node dist/db/init-schema.js
```

### 4. Deploy
```bash
git push railway main
```

## 🛠️ Desenvolvimento Local

### 1. Instalar Dependências
```bash
pnpm install
```

### 2. Configurar .env
```bash
cp .env.example .env
# Editar .env com suas credenciais
```

### 3. Inicializar Banco
```bash
# Criar banco PostgreSQL local
createdb memodrops_harvester

# Executar schema
pnpm tsx src/db/init-schema.ts
```

### 4. Rodar Servidor
```bash
pnpm dev
```

### 5. Testar Coleta Manual
```bash
curl -X POST http://localhost:3001/admin/harvest/run
```

## 📊 Endpoints

### Calcular IC
```bash
curl "http://localhost:3001/api/ic/calculate?topic=Direito%20Constitucional&subject=Direito"
```

Resposta:
```json
{
  "topic": "Direito Constitucional",
  "subject": "Direito",
  "ic": 9.5
}
```

### Identificar Gaps
```bash
curl "http://localhost:3001/api/ic/gaps?subject=Direito&minIC=7"
```

Resposta:
```json
{
  "gaps": [
    {
      "topic": "Princípios Fundamentais",
      "ic": 9.5,
      "frequency": 150,
      "cardsCount": 3,
      "gap": 6.5
    }
  ]
}
```

## 🔄 Cron Job (Opcional)

Para coleta automática diária, adicionar no Railway:

```bash
# Instalar node-cron
# Adicionar em src/server.ts:

import cron from 'node-cron';
import { runAll } from './jobs/harvest.js';

// Executar diariamente às 2h da manhã
cron.schedule('0 2 * * *', async () => {
  console.log('🕐 Executando coleta agendada...');
  await runAll();
});
```

## 📈 Monitoramento

Dashboard estático disponível em `/dashboard` (separado).

## 🔐 Segurança

- Detecção automática de PII
- Licenças inferidas automaticamente
- Rate limiting (recomendado para produção)
- CORS configurado para MemoDrops

## 📝 Licença

MIT
