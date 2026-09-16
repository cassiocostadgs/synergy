# Deploy — Vercel + Render + Neon

Publicação gratuita do Synergy em três serviços. Para o portal interno da DB1
(Coolify), veja o `README.md` — lá é um container só, com o `Dockerfile` da raiz.

## Por que três serviços

A Vercel hospeda **arquivos estáticos e funções serverless**. O `apps/api` é um
servidor Go de longa duração: abre um pool de conexões pgx e aplica as migrations
na subida (`cmd/api/main.go`). Isso não cabe no modelo serverless — cada
invocação fria abriria um pool novo e esgotaria as conexões do banco.

Então a divisão é:

| Camada | Onde | Por quê |
| :--- | :--- | :--- |
| `apps/web` | **Vercel** | Estático puro. CDN, nunca dorme. |
| `apps/api` | **Render** | Roda container. Plano gratuito. |
| PostgreSQL | **Neon** | Free tier permanente — o do Render expira. |

---

## 1. Banco (Neon)

1. [neon.tech](https://neon.tech) → novo projeto, região `us-east` (mesma costa
   do Render, para a latência não pesar).
2. Copie a connection string **pooled** — a que tem `-pooler` no host.
3. Ajuste o final antes de usar:

```
postgres://user:senha@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&pool_max_conns=5
```

- `sslmode=require` — o Neon recusa conexão sem TLS. O `sslmode=disable` do
  `.env.example` vale só para o Postgres local do compose.
- `pool_max_conns=5` — o padrão do pgx é 4× o número de CPUs, que estoura o
  limite de conexões do plano gratuito.

## 2. API (Render)

O `render.yaml` na raiz já descreve o serviço.

1. [render.com](https://render.com) → **New → Blueprint** → aponte para o repo.
2. O Render pergunta os valores marcados como `sync: false`:

| Variável | Valor |
| :--- | :--- |
| `DATABASE_URL` | a string do Neon do passo 1 |
| `SEED_ADMIN_PASSWORD` | a senha do Admin inicial (mín. 8 caracteres) |
| `CORS_ALLOWED_ORIGINS` | **deixe vazia por enquanto** — só existe após o passo 3 |

O `JWT_SECRET` o Render gera sozinho. Anote a URL final, algo como
`https://synergy-api.onrender.com`.

O seed roda no boot pelo `apps/api/docker-entrypoint.sh` e é idempotente: cria o
Admin na primeira subida e não faz nada nas seguintes.

## 3. Front (Vercel)

O `apps/web/vercel.json` já traz o fallback do SPA, o cache dos assets e os
headers de segurança — é o equivalente do `apps/web/nginx.conf`.

1. [vercel.com](https://vercel.com) → **Add New → Project** → importe o repo.
2. **Root Directory: `apps/web`** ← o passo que se erra em monorepo.
3. Environment Variables:

| Variável | Valor |
| :--- | :--- |
| `VITE_API_URL` | a URL do Render, sem barra no fim |
| `VITE_MS_TENANT_ID` | GUID do Entra, ou vazio |
| `VITE_MS_CLIENT_ID` | GUID do Entra, ou vazio |

4. Deploy. Anote a URL, algo como `https://synergy.vercel.app`.

## 4. Fechar o circuito

Volte ao Render e preencha `CORS_ALLOWED_ORIGINS` com a URL da Vercel, exata e
com `https`. A API compara a origem por igualdade literal
(`internal/handler/middleware.go`), então `http://`, barra no fim ou domínio
diferente não casam.

Redeploy da API. Abra a URL da Vercel e entre com o Admin.

---

## Armadilhas

**As `VITE_*` são resolvidas no build, não em runtime.** Mudá-las na Vercel não
tem efeito até um *Redeploy* — o valor está literalmente dentro do bundle que o
navegador baixou.

**Preview deploys da Vercel quebram no CORS.** Cada preview ganha um subdomínio
novo, e a API só aceita origens listadas. Ou adicione as URLs de preview a
`CORS_ALLOWED_ORIGINS` (é lista separada por vírgula), ou aceite que só produção
funciona. Não use `*`: com `Authorization` no header, isso libera a API para
qualquer site.

**O plano gratuito do Render dorme.** 15 minutos sem requisição e o container
desliga; a chamada seguinte espera o cold start — na casa de dezenas de
segundos. Para demo interna costuma passar, mas quem abrir o login vai achar que
travou. É o motivo de o front não passar por proxy da Vercel: chamada direta do
navegador espera o tempo que precisar, enquanto um proxy estouraria o timeout.

**SSO da Microsoft precisa do redirect URI novo.** O MSAL usa
`window.location.origin` (`features/auth/microsoft.ts`), então registre
`https://synergy.vercel.app` como Redirect URI (tipo SPA) no app registration do
Entra. Sem isso o SSO falha só em produção.

**`MS_TENANT_ID` e `MS_CLIENT_ID` andam em par.** O `config.Load` recusa subir
com uma só preenchida, e exige GUID — não o nome do domínio.
