# 🚀 Deploy do MemoDrops Backoffice no Railway

## 📋 Pré-requisitos

- Conta no Railway (https://railway.app)
- Repositório Git (GitHub, GitLab ou Bitbucket)

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────┐
│   RAILWAY PROJECT: memodrops-backoffice│
│                                         │
│  ┌──────────────┐    ┌──────────────┐  │
│  │  PostgreSQL  │←───│  Backoffice  │  │
│  │   (Plugin)   │    │   (Service)  │  │
│  └──────────────┘    └──────────────┘  │
│                            │            │
│                            ↓            │
│                      Dashboard (/)      │
│                      APIs (/api/*)      │
└─────────────────────────────────────────┘
```

## 📝 Passo a Passo

### 1. Criar Projeto no Railway

```bash
# Instalar Railway CLI (opcional)
npm install -g @railway/cli

# Login
railway login

# Criar projeto
railway init
```

Ou via interface web: https://railway.app/new

### 2. Adicionar PostgreSQL

No dashboard do Railway:
1. Clique em "New" → "Database" → "Add PostgreSQL"
2. Aguarde provisionamento (1-2 minutos)
3. Railway criará automaticamente as variáveis de ambiente

### 3. Configurar Variáveis de Ambiente

No Railway, adicione as seguintes variáveis:

```env
# Geradas automaticamente pelo PostgreSQL plugin:
PGHOST=<auto>
PGPORT=<auto>
PGDATABASE=<auto>
PGUSER=<auto>
PGPASSWORD=<auto>

# Configurar manualmente:
PORT=3001
USER_AGENT=MemoDropsHarvester/1.0
NODE_ENV=production
```

### 4. Conectar Repositório

1. No Railway, clique em "New" → "GitHub Repo"
2. Selecione o repositório `memodrops-backoffice`
3. Railway detectará automaticamente o `Dockerfile`

### 5. Inicializar Schema do Banco

Após o primeiro deploy, execute:

```bash
# Via Railway CLI
railway run node dist/db/init-schema.js

# Ou via Railway Dashboard
# Settings → Deploy → Run Command
node dist/db/init-schema.js
```

### 6. Verificar Deploy

Acesse as URLs:

- **Health Check:** `https://<seu-app>.railway.app/health`
- **Dashboard:** `https://<seu-app>.railway.app/dashboard/`
- **API IC:** `https://<seu-app>.railway.app/api/ic/calculate?topic=teste`

### 7. Configurar no MemoDrops

No projeto MemoDrops, adicione a variável de ambiente:

```env
BACKOFFICE_URL=https://<seu-app>.railway.app
```

## 🔄 Cron Job (Coleta Automática)

Para coleta diária automática, adicione no `src/server.ts`:

```typescript
import cron from 'node-cron';
import { runAll } from './jobs/harvest.js';

// Executar diariamente às 2h da manhã (horário de Brasília)
cron.schedule('0 2 * * *', async () => {
  console.log('🕐 Executando coleta agendada...');
  try {
    await runAll();
    console.log('✅ Coleta concluída com sucesso');
  } catch (error) {
    console.error('❌ Erro na coleta:', error);
  }
});
```

Depois, adicione `node-cron` nas dependências:

```bash
pnpm add node-cron
```

## 📊 Monitoramento

### Logs

```bash
# Via CLI
railway logs

# Ou via Dashboard
# Deployments → Logs
```

### Métricas

No Railway Dashboard:
- **Metrics** → CPU, Memória, Network
- **Deployments** → Status de builds

### Alertas

Configure no Railway:
- Settings → Notifications
- Adicione webhook do Slack/Discord

## 🔐 Segurança

### CORS

O backoffice já está configurado para aceitar requisições do MemoDrops.

Para adicionar mais domínios, edite `src/server.ts`:

```typescript
import cors from 'cors';

app.use(cors({
  origin: [
    'https://memodrops.app',
    'https://staging.memodrops.app',
  ],
  credentials: true,
}));
```

### Rate Limiting (Recomendado)

```bash
pnpm add express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições por IP
});

app.use('/api/', limiter);
```

## 🐛 Troubleshooting

### Erro: "Cannot connect to database"

1. Verifique se o PostgreSQL plugin está rodando
2. Confirme que as variáveis `PG*` estão configuradas
3. Teste conexão: `railway run psql $DATABASE_URL`

### Erro: "Schema not found"

Execute o script de inicialização:

```bash
railway run node dist/db/init-schema.js
```

### Erro: "Port already in use"

O Railway atribui a porta automaticamente via `process.env.PORT`.  
Não force uma porta específica no código.

### Build falha

1. Verifique logs: `railway logs`
2. Teste build local: `pnpm build`
3. Confirme que `Dockerfile` está correto

## 📈 Escalabilidade

### Horizontal Scaling

Railway suporta múltiplas réplicas:

```bash
railway scale --replicas 2
```

### Vertical Scaling

Upgrade do plano no Railway Dashboard:
- Settings → Plan → Upgrade

### Database Connection Pooling

Já configurado no `src/db/index.ts` com `max: 10` conexões.

## 💰 Custos Estimados

**Railway Pricing (2025):**
- PostgreSQL: $5/mês (1GB)
- Backoffice Service: $5-10/mês (depende do uso)
- **Total:** ~$10-15/mês

**Otimização:**
- Use cron job ao invés de polling constante
- Configure cache para APIs de IC
- Limite requisições com rate limiting

## 🔗 Links Úteis

- Railway Dashboard: https://railway.app/dashboard
- Railway Docs: https://docs.railway.app
- PostgreSQL Docs: https://www.postgresql.org/docs/

## ✅ Checklist de Deploy

- [ ] PostgreSQL provisionado
- [ ] Variáveis de ambiente configuradas
- [ ] Repositório conectado
- [ ] Build bem-sucedido
- [ ] Schema inicializado
- [ ] Health check respondendo
- [ ] Dashboard acessível
- [ ] APIs de IC funcionando
- [ ] MemoDrops conectado (BACKOFFICE_URL)
- [ ] Cron job configurado (opcional)
- [ ] Monitoramento ativo
- [ ] Backups configurados

## 🎉 Pronto!

Seu backoffice está no ar! 🚀

Próximos passos:
1. Testar coleta manual: `POST /admin/harvest/run`
2. Verificar dashboard: `https://<seu-app>.railway.app/dashboard/`
3. Integrar com MemoDrops
4. Configurar alertas
5. Monitorar logs

---

**Dúvidas?** Consulte a documentação ou abra uma issue no repositório.
