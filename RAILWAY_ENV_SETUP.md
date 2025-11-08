# Configuração de Variáveis de Ambiente no Railway

## DATABASE_URL

Para configurar a DATABASE_URL no Railway Dashboard:

1. Acesse https://railway.app
2. Entre no projeto **memodrops-backoffice**
3. Clique no serviço da **aplicação** (memodrops-backoffice)
4. Clique na aba **"Variables"**
5. Adicione ou edite a variável `DATABASE_URL` com o valor:

```
postgresql://postgres:XJIZmpDaUUZFQzDhGQSSaxjUmVlGTCth@nozomi.proxy.rlwy.net:51514/railway
```

6. Salve e aguarde o redeploy automático (~1 minuto)

## Verificação

Após configurar, teste os endpoints:

```bash
# Health check
curl https://memodrops-backoffice-production.up.railway.app/api/health

# Status do processamento
curl https://memodrops-backoffice-production.up.railway.app/api/process/status

# Processar um item de teste
curl -X POST https://memodrops-backoffice-production.up.railway.app/api/test/process-one
```

## Alternativa: Via Railway CLI

Se preferir usar o CLI (requer login no navegador):

```bash
railway login --browserless
# Siga as instruções no terminal

railway variables --set DATABASE_URL="postgresql://postgres:XJIZmpDaUUZFQzDhGQSSaxjUmVlGTCth@nozomi.proxy.rlwy.net:51514/railway"
```
