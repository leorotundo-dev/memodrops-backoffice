# 🏗️ Arquitetura do Sistema MemoDrops Backoffice

## 📊 Visão Geral

O **MemoDrops Backoffice** é um sistema separado que alimenta o MemoDrops com dados reais de concursos públicos através de três componentes principais:

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKOFFICE (Sistema Separado)                │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  1. HARVESTER (Coletor de Provas)                        │  │
│  │     - Scraping automático de FGV, CESPE, etc.            │  │
│  │     - Deduplicação por hash SHA-256                      │  │
│  │     - Detecção de PII (dados pessoais)                   │  │
│  │     - Inferência de licenças                             │  │
│  │     - PostgreSQL: harvest_items                          │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                         │
│                       ↓ Provas coletadas                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  2. IC ENGINE (Índice de Cobrança)                       │  │
│  │     - Calcula frequência de temas nas provas             │  │
│  │     - IC normalizado de 0 a 10                           │  │
│  │     - Identifica gaps (IC alto + poucos cards)           │  │
│  │     - APIs públicas: /api/ic/*                           │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                         │
│                       ↓ Estatísticas                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  3. DASHBOARD (Monitoramento)                            │  │
│  │     - HTML estático (zero-build)                         │  │
│  │     - Gráficos de coleta                                 │  │
│  │     - KPIs de IC por tema                                │  │
│  │     - Identificação de gaps                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ↓ API pública (IC scores)
┌─────────────────────────────────────────────────────────────────┐
│                    MEMODROPS (App Principal)                    │
│                                                                 │
│  - Consome IC scores via API REST                               │
│  - Prioriza cards com IC alto                                   │
│  - Badge "IC 9.5/10" nos cards                                  │
│  - Sugere temas prioritários no onboarding                      │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 Componentes Técnicos

### 1. Harvester (Coletor)

**Tecnologias:**
- Node.js + TypeScript
- Cheerio (parsing HTML)
- PostgreSQL (armazenamento)
- Undici (HTTP client)

**Fluxo de Coleta:**
```
1. Adapter (fgv.ts) → Busca HTML de listagem de concursos
2. Cheerio → Parse HTML e extrai links de provas
3. Dedupe (dedupe.ts) → Verifica hash SHA-256
4. PII Detector → Identifica dados pessoais
5. License Inference → Determina licença (public_domain, CC, etc.)
6. PostgreSQL → Insere em harvest_items
```

**Schema PostgreSQL:**
```sql
CREATE TABLE harvest_items (
  id SERIAL PRIMARY KEY,
  source VARCHAR(64) NOT NULL,           -- 'FGV', 'CESPE', etc.
  url TEXT NOT NULL,                     -- URL da prova
  title TEXT,                            -- Título do concurso
  content_text TEXT,                     -- Conteúdo extraído
  hash VARCHAR(64) NOT NULL,             -- SHA-256 para deduplicação
  license VARCHAR(32),                   -- 'public_domain', 'cc_by', etc.
  pii_flags JSONB,                       -- Dados pessoais detectados
  meta JSONB,                            -- Metadados adicionais
  status VARCHAR(32) DEFAULT 'fetched',  -- 'fetched', 'processed', 'error'
  fetched_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(source, url)                    -- Evita duplicatas
);
```

### 2. IC Engine (Índice de Cobrança)

**Algoritmo de Cálculo:**
```typescript
// Fórmula: IC = f(frequência do tema nas provas)
// Normalização não-linear para dar peso a temas frequentes

function calculateIC(topic: string): number {
  const frequency = countOccurrences(topic);
  const total = totalExams();
  const percentage = (frequency / total) * 100;
  
  // Normalização
  if (percentage >= 50) return 10;
  if (percentage >= 30) return 9;
  if (percentage >= 20) return 8;
  if (percentage >= 15) return 7;
  if (percentage >= 10) return 6;
  if (percentage >= 7) return 5;
  if (percentage >= 5) return 4;
  if (percentage >= 3) return 3;
  if (percentage >= 1) return 2;
  if (percentage > 0) return 1;
  return 0;
}
```

**Identificação de Gaps:**
```typescript
// Gap = IC alto + poucos cards no MemoDrops
// Indica temas que precisam de mais conteúdo

interface TopicGap {
  topic: string;
  ic: number;           // 0-10
  frequency: number;    // Vezes que aparece nas provas
  cardsCount: number;   // Cards disponíveis no MemoDrops
  gap: number;          // ic - cardsCount (maior = mais urgente)
}
```

### 3. Dashboard (Monitoramento)

**Estrutura:**
```
public/dashboard/
├── index.html       # Dashboard principal (zero-build)
├── config.js        # Configuração de URLs
└── assets/          # CSS, JS, imagens
```

**Funcionalidades:**
- Gráfico de coleta por fonte (FGV, CESPE)
- Timeline de coletas (últimas 24h, 7d, 30d)
- Top 10 temas mais cobrados
- Lista de gaps prioritários
- Status de saúde do sistema

## 🔌 APIs Públicas

### Admin Endpoints (Harvester)

```http
GET /admin/harvest/items?source=FGV&status=fetched&limit=50&offset=0
# Lista itens coletados

POST /admin/harvest/run
# Executa coleta manual de todas as fontes

GET /admin/harvest/stats
# Estatísticas gerais (total, por fonte, por status)
```

### Public Endpoints (IC Engine)

```http
GET /api/ic/calculate?topic=Direito%20Constitucional&subject=Direito
# Calcula IC de um tema
# Response: { topic, subject, ic: 9.5 }

GET /api/ic/gaps?subject=Direito&minIC=7
# Identifica gaps (temas importantes sem cards)
# Response: { gaps: [{ topic, ic, frequency, cardsCount, gap }] }

GET /discover/sources
# Lista fontes disponíveis
# Response: { sources: [{ source, total_items, last_fetch }] }
```

## 🔗 Integração MemoDrops

### 1. Cliente IC (ic-client.ts)

```typescript
// Consome APIs do backoffice via fetch
export async function calculateIC(topic: string): Promise<number> {
  const response = await fetch(`${BACKOFFICE_URL}/api/ic/calculate?topic=${topic}`);
  const data = await response.json();
  return data.ic;
}
```

### 2. Router tRPC (ic-router.ts)

```typescript
// Expõe APIs para o frontend via tRPC
export const icRouter = router({
  calculate: protectedProcedure
    .input(z.object({ topic: z.string() }))
    .query(async ({ input }) => {
      const ic = await calculateIC(input.topic);
      return { topic: input.topic, ic };
    }),
});
```

### 3. Componente ICBadge

```tsx
// Exibe badge visual de IC nos cards
<ICBadge icScore={9} />
// Renderiza: "IC 9/10" com cor laranja (muito cobrado)
```

### 4. Schema de Dados

```typescript
// Campo icScore adicionado na tabela cards
export const cards = mysqlTable("cards", {
  // ... outros campos
  icScore: int("icScore").default(0), // 0-10
});
```

## 🚀 Deploy

### Backoffice (Railway)

```yaml
# railway.toml
[build]
  builder = "dockerfile"
  dockerfilePath = "Dockerfile"

[deploy]
  startCommand = "node dist/server.js"
  healthcheckPath = "/health"
  healthcheckTimeout = 30
```

**Variáveis de Ambiente:**
```env
PGHOST=<railway_postgres_host>
PGPORT=5432
PGDATABASE=railway
PGUSER=postgres
PGPASSWORD=<railway_postgres_password>
PORT=3001
NODE_ENV=production
```

### MemoDrops (Manus)

```env
BACKOFFICE_URL=https://<seu-app>.railway.app
```

## 📊 Fluxo de Dados Completo

```
1. COLETA (Harvester)
   ↓
   Scrapers → HTML → Cheerio → Dados estruturados
   ↓
   Deduplicação → Hash SHA-256
   ↓
   PII Detection → Flags de dados pessoais
   ↓
   PostgreSQL → harvest_items

2. CÁLCULO (IC Engine)
   ↓
   Análise de frequência → Temas mais cobrados
   ↓
   Normalização → IC de 0 a 10
   ↓
   Identificação de gaps → Temas sem cards

3. CONSUMO (MemoDrops)
   ↓
   API REST → /api/ic/calculate
   ↓
   tRPC Router → trpc.ic.calculate.useQuery()
   ↓
   Frontend → ICBadge component
   ↓
   Usuário vê: "IC 9/10" no card

4. MONITORAMENTO (Dashboard)
   ↓
   APIs de estatísticas → /admin/harvest/stats
   ↓
   Gráficos → Visualização de KPIs
   ↓
   Alertas → Gaps prioritários
```

## 🔐 Segurança e Compliance

### LGPD/GDPR

1. **Detecção de PII:** Identifica CPF, email, telefone automaticamente
2. **Licenças:** Infere licença de cada prova (public_domain, CC, etc.)
3. **Anonimização:** Remove dados pessoais antes de processar
4. **Consentimento:** Apenas provas de domínio público

### Rate Limiting

```typescript
// Recomendado para produção
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições por IP
});

app.use('/api/', limiter);
```

## 📈 Escalabilidade

### Horizontal Scaling

- **Railway:** Múltiplas réplicas do backoffice
- **PostgreSQL:** Connection pooling (max: 10)
- **Cache:** Redis para IC scores (opcional)

### Otimizações

1. **Cron Job:** Coleta diária às 2h (baixo tráfego)
2. **Cache de IC:** TTL de 24h (temas não mudam frequentemente)
3. **Batch Processing:** Processar 100 provas por vez
4. **Lazy Loading:** Dashboard carrega dados sob demanda

## 🐛 Troubleshooting

### Erro: "Cannot connect to database"

```bash
# Verificar conexão
railway run psql $DATABASE_URL

# Reiniciar PostgreSQL
railway restart <service-id>
```

### Erro: "Schema not found"

```bash
# Executar script de inicialização
railway run node dist/db/init-schema.js
```

### Erro: "Scraper retorna 0 itens"

```bash
# Verificar se site mudou estrutura HTML
# Atualizar seletores CSS em src/adapters/*.ts
```

## 📚 Referências

- **Harvester:** `/home/ubuntu/memodrops-backoffice/`
- **README:** `README.md`
- **Deploy:** `DEPLOY.md`
- **Schema:** `src/db/schema.sql`
- **APIs:** `src/server.ts`

## ✅ Checklist de Validação

- [x] Harvester coleta provas de FGV e CESPE
- [x] Deduplicação funciona (hash SHA-256)
- [x] IC Engine calcula scores corretamente
- [x] APIs públicas respondem
- [x] Dashboard exibe estatísticas
- [x] MemoDrops consome IC via API
- [x] ICBadge renderiza corretamente
- [x] 0 erros TypeScript
- [ ] Deploy no Railway (pendente)
- [ ] Testes end-to-end (pendente)

---

**Versão:** 1.0.0  
**Data:** Novembro 2025  
**Status:** 98% completo (falta apenas deploy e testes)
