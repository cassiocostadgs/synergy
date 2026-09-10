# Synergy — MVP

Hub de engajamento e gestão para times remotos. Este repositório é um monorepo com o
backend em Go (`apps/api`) e o frontend em React (`apps/web`).

## O que está entregue

| Módulo | PRD |
| :--- | :--- |
| Times e membros, com RBAC e as regras de liderança (RN1/RN2) | 3.1 |
| Sorteio de Temas e Brackets — dinâmicas sem persistência | 3.2.1 e 3.2.2 |
| Moving Motivators, com revisão a cada 90 dias | 3.2.3 |
| Radar do Time — agregado e mapa de calor individual | 3.2.4 |
| Autogestão de conta: dados próprios e troca de senha | 3.3 |
| Gestão de acessos pelo Admin: papel, senha de terceiros e inativação | 3.4.1 a 3.4.3 |
| Login com SSO da Microsoft (Entra ID), opcional | 3.4.4 |

Fora do MVP: **Metas**, **Dashboard / Behavioral Insights**, as demais práticas do
Management 3.0 (Kudo Box, Niko-Niko, Personal Map), o papel **Auditor** e as regras de
**gamificação** — `xp` e `level` existem no banco, nunca são alterados e por isso não
aparecem na interface. A lista completa, com o motivo de cada descarte, está em `PRD.md`,
seção 5.

---

## Pré-requisitos

| Ferramenta | Versão usada |
| :--- | :--- |
| Go | 1.27 |
| Node.js | 24 (npm 11) |
| PostgreSQL | 17 |

---

## 1. Banco de dados

Crie o banco e o usuário da aplicação:

```sql
CREATE ROLE synergy LOGIN PASSWORD 'synergy';
CREATE DATABASE synergy OWNER synergy;
```

As migrations são embutidas no binário e aplicadas automaticamente na subida da API
(e também pelo comando de seed) — não é preciso rodar nenhuma ferramenta externa.

## 2. Backend (`apps/api`)

A API lê a configuração **direto das variáveis de ambiente** — o `.env.example` serve de
referência, mas não é carregado automaticamente (não há loader de `.env` no projeto).

### Windows (recomendado): use os scripts

Os scripts em `apps/api/scripts/` já definem as variáveis de desenvolvimento e contornam
a restrição de antivírus descrita abaixo:

```powershell
cd apps\api
.\scripts\seed.ps1    # migrations + usuário Admin inicial (idempotente)
.\scripts\dev.ps1     # sobe a API em http://localhost:8080
.\scripts\test.ps1    # testes das regras de negócio (RN1/RN2)
```

### Outros ambientes

```bash
cd apps/api
export DATABASE_URL="postgres://synergy:synergy@localhost:5432/synergy?sslmode=disable"
export JWT_SECRET="dev-secret-synergy-mvp"
export SEED_ADMIN_PASSWORD="synergy123"

go run ./cmd/seed   # migrations + admin inicial
go run ./cmd/api    # http://localhost:8080
go test ./...       # testes (não precisam de banco)
```

### ⚠️ Máquinas com antivírus corporativo restritivo

Em ambientes com política de reputação de executáveis (regra tipo *"block executable
files unless they meet a prevalence, age, or trusted list criterion"*), **`go run` e
`go test ./...` falham com "Acesso negado"**: ambos compilam e executam o binário na
hora, e executáveis novos são barrados até ganharem idade/prevalência.

Os scripts `dev.ps1` e `seed.ps1` funcionam porque compilam para um caminho fixo fora
do `%TEMP%`. Já os **binários de teste continuam sendo bloqueados** nessas máquinas —
`test.ps1` detecta a situação e explica as saídas:

1. Pedir ao TI exclusão de antivírus para a pasta de build do Go;
2. Rodar os testes na CI;
3. Rodar em WSL ou container (binário Linux, fora do alcance da política).

## 3. Frontend (`apps/web`)

```bash
cd apps/web
cp .env.example .env   # VITE_API_URL aponta para a API
npm install
npm run dev            # http://localhost:5173
```

Acesse com o usuário criado no seed (padrão: `admin@synergy.dev`).

---

## 4. SSO da Microsoft (opcional)

O login com **"Entrar com Microsoft"** (Entra ID) convive com o login por e-mail e senha.
Sem as variáveis abaixo, o botão simplesmente não aparece e nada muda.

A regra que organiza o resto: **a Microsoft diz quem a pessoa é; o Synergy diz se ela pode
entrar**. Não há provisionamento automático — sem cadastro feito pelo Admin, o acesso é
recusado com a orientação de procurar o administrador (PRD seção 3.4.4).

### 4.1. App registration no Entra

Em **entra.microsoft.com** → *Identity* → *Applications* → *App registrations* →
**New registration** (os nomes mudam entre versões do portal):

| Campo | Valor | Por quê |
| :--- | :--- | :--- |
| Name | `Synergy` | aparece na tela de consentimento |
| Supported account types | **single tenant** (só este diretório) | é o que impede conta Microsoft de fora da organização |
| Redirect URI | plataforma **Single-page application (SPA)** + `http://localhost:5173` | precisa ser SPA, não "Web": é o que habilita Authorization Code + PKCE |

Depois de criar, a página *Overview* mostra os dois valores que a aplicação usa:
**Application (client) ID** e **Directory (tenant) ID**. Em *Authentication*, acrescente a
URL de produção como segundo redirect URI. Em *Token configuration*, vale adicionar o claim
opcional **`email`** — sem ele o Entra pode não enviar o e-mail, e a API cai no
`preferred_username` (que num tenant corporativo é o mesmo endereço).

Não marque as caixas de *implicit grant* ("Access tokens"/"ID tokens"): são de um fluxo
antigo e desnecessárias com plataforma SPA. O aplicativo usa apenas `openid`, `profile` e
`email` — **não acessa o Microsoft Graph**, então não lê e-mail, arquivo ou calendário de
ninguém.

### 4.2. Configuração

Os dois GUIDs **não são segredo**: o front os embute no bundle que o navegador baixa. Neste
fluxo não existe client secret.

```powershell
# Backend (apps/api) — no shell, antes de .\scripts\dev.ps1
$env:MS_TENANT_ID = '<Directory (tenant) ID>'
$env:MS_CLIENT_ID = '<Application (client) ID>'
```

```bash
# Frontend (apps/web) — em .env, com os MESMOS valores
VITE_MS_TENANT_ID=<Directory (tenant) ID>
VITE_MS_CLIENT_ID=<Application (client) ID>
```

Os valores precisam ser iguais nos dois lados: o token que o front obtém é emitido *para*
aquele client ID, e a API recusa token emitido para outro aplicativo.

### 4.3. Quando algo não funciona

| Sintoma | Causa provável |
| :--- | :--- |
| A API não sobe, reclamando de `MS_TENANT_ID` | só uma das duas variáveis foi definida, ou veio o nome do domínio no lugar do Directory ID (GUID) |
| O botão não aparece | as variáveis `VITE_*` não estavam definidas **no momento do build** (ver seção 5) |
| "não há cadastro no Synergy para *e-mail*" | funcionou como esperado: falta o Admin cadastrar aquele e-mail |
| "esta conta Microsoft não pertence à organização configurada" | login com conta de outro tenant (ou conta pessoal) |
| "o login com a Microsoft não pôde ser validado" | client ID divergente entre front e API, ou app registration alterado |
| Erro 500 no login por SSO | a API não conseguiu falar com o Entra — é falha de infraestrutura, e é 500 de propósito para não parecer credencial inválida |

---

## 5. Deploy

### ⚠️ O frontend exige fallback para o `index.html`

O app usa `BrowserRouter` (URLs limpas, sem `#`), então rotas como `/perfil` e
`/times/<id>` **existem apenas no navegador** — não há arquivo com esses nomes no disco.
Se o servidor não estiver configurado, acessar `https://seudominio/perfil` direto (ou dar
F5 nessa página) devolve **404 do servidor**, embora a navegação por dentro do app
funcione. O dev server do Vite já trata isso; produção precisa da regra explícita.

A configuração é: **toda rota desconhecida devolve `index.html`**, e o React Router
resolve o resto.

### `VITE_API_URL` é resolvida no build, não em runtime

O Vite substitui a variável pelo valor literal durante `npm run build`. Portanto ela
precisa estar definida **no momento de buildar** — mudá-la depois no servidor não tem
efeito algum.

```bash
cd apps/web

# API no mesmo domínio, atrás de proxy (dispensa CORS): deixe o valor vazio
echo "VITE_API_URL=" > .env.production

# API em outro domínio:
# echo "VITE_API_URL=https://api.seudominio.com" > .env.production

npm run build          # gera apps/web/dist/
```

| Valor | Requisições vão para |
| :--- | :--- |
| vazio (ou `/`) | mesma origem do frontend — `/api/v1/…` |
| `https://api.seudominio.com` | esse domínio (exige `CORS_ALLOWED_ORIGINS` na API) |
| variável ausente | `http://localhost:8080` — o padrão de desenvolvimento |

Barras finais são removidas automaticamente, então `https://api.seudominio.com/` também
funciona. Grave o arquivo **sem BOM**: um `.env` com BOM faz o Vite ignorar a chave
silenciosamente e cair no padrão de desenvolvimento (`Set-Content -Encoding utf8` no
PowerShell 5.1 escreve BOM — use `-Encoding utf8NoBOM`, o `echo` acima, ou o VS Code).

### Exemplo com nginx (frontend + proxy da API no mesmo domínio)

```nginx
server {
    listen 80;
    server_name synergy.exemplo.com;

    root /var/www/synergy;   # conteúdo de apps/web/dist
    index index.html;

    # SPA: rota desconhecida devolve o index.html para o React Router resolver
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Os assets têm hash no nome, então podem ter cache longo
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API no mesmo domínio — com isso não há CORS a configurar
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

O equivalente em outras hospedagens: `_redirects` com `/* /index.html 200` (Netlify),
`rewrites` para `/index.html` (Vercel), *Error Document* apontando para `index.html`
(S3 + CloudFront), `navigationFallback` (Azure Static Web Apps) ou `web.config` com
regra de *rewrite* (IIS).

### Variáveis da API em produção

| Variável | Cuidado |
| :--- | :--- |
| `DATABASE_URL` | usuário sem privilégio de superusuário; TLS ativo (`sslmode=require`) |
| `JWT_SECRET` | segredo forte e exclusivo do ambiente — trocá-lo invalida as sessões ativas |
| `CORS_ALLOWED_ORIGINS` | só o domínio real do frontend; desnecessário se a API estiver atrás do mesmo domínio |
| `API_PORT` | a porta que o proxy encaminha |
| `MS_TENANT_ID` / `MS_CLIENT_ID` | opcionais e não secretas; precisam bater com as `VITE_MS_*` usadas no build do front, e o redirect URI de produção tem que estar no app registration |

As migrations são aplicadas automaticamente na subida da API, então o deploy não tem
passo manual de banco. Rode `./cmd/seed` uma única vez, para criar o Admin inicial.

---

## Arquitetura

### Backend — camadas (dependências sempre para dentro)

```text
handler  →  usecase  →  domain  ←  repository
```

* **`internal/domain`** — entidades, enums e as interfaces de repositório. Sem dependências externas.
* **`internal/usecase`** — regras de negócio (RN1 e RN2 vivem aqui) e autorização por escopo.
* **`internal/repository`** — implementação PostgreSQL (pgx) + migrations embutidas.
* **`internal/handler`** — rotas, DTOs, middlewares e tradução de erro de domínio → status HTTP.
* **`internal/auth`** / **`internal/config`** — detalhes técnicos (bcrypt, JWT, env) mantidos fora das camadas de negócio.

### Regras de negócio do épico

* **RN1** — todo time tem exatamente **1 Gestor Principal** e no máximo **1 Gestor de Apoio**.
  * O time nasce com o seu Gestor Principal na mesma transação.
  * O Gestor Principal não pode ser removido nem rebaixado: só sai por **transferência de liderança**.
  * Garantido também no banco por índices únicos parciais (defesa em profundidade).
* **RN2** — apenas os **Gestores do próprio time** (ou o Admin global) administram os membros.

### Papéis

`ADMIN`, `GESTOR` e `COLABORADOR` estão implementados. `AUDITOR` existe no enum, mas está
**fora do escopo do MVP**: não recebe sessão nem regras de permissão.

---

## Endpoints

| Método | Rota | Acesso |
| :--- | :--- | :--- |
| GET | `/` | público — identifica o serviço |
| GET | `/health` | público |
| POST | `/api/v1/auth/login` | público |
| POST | `/api/v1/auth/microsoft` | público — troca o ID token do Entra pela sessão do Synergy (seção 4) |
| GET | `/api/v1/me` | autenticado |
| PATCH | `/api/v1/me` | autenticado — edita nome e hobby próprios |
| PATCH | `/api/v1/me/password` | autenticado — troca a própria senha (exige a atual) |
| GET | `/api/v1/me/motivators` | autenticado — Moving Motivators próprio |
| PUT | `/api/v1/me/motivators` | autenticado — substitui a ordenação dos 10 motivadores |
| GET | `/api/v1/users` | Admin, Gestor |
| POST | `/api/v1/users` | Admin |
| PATCH | `/api/v1/users/{userId}/status` | Admin — ativa ou inativa um acesso |
| PATCH | `/api/v1/users/{userId}/role` | Admin — altera o papel global |
| POST | `/api/v1/users/{userId}/reset-password` | Admin — redefine a senha de outro usuário |
| GET | `/api/v1/teams` | autenticado (Admin vê todos) — cada time traz `myRole`, o papel de quem pediu |
| POST | `/api/v1/teams` | Admin, Gestor |
| GET | `/api/v1/teams/{teamId}` | membros do time / Admin |
| PATCH | `/api/v1/teams/{teamId}` | Gestores do time / Admin |
| POST | `/api/v1/teams/{teamId}/archive` | Gestores do time / Admin |
| GET | `/api/v1/teams/{teamId}/motivators` | Gestores do time / Admin — Radar agregado |
| GET | `/api/v1/teams/{teamId}/members` | membros do time / Admin |
| POST | `/api/v1/teams/{teamId}/members` | Gestores do time / Admin |
| PATCH | `/api/v1/teams/{teamId}/members/{userId}` | Gestores do time / Admin |
| DELETE | `/api/v1/teams/{teamId}/members/{userId}` | Gestores do time / Admin |
| POST | `/api/v1/teams/{teamId}/transfer-principal` | Gestor Principal / Admin |

Todas as respostas usam o envelope `{ "data": … }` ou `{ "error": { "code", "message" } }`,
inclusive rota não encontrada (404) e método não permitido (405).

Abrir a raiz da API no navegador devolve a identificação do serviço — as rotas de negócio
ficam sob `/api/v1` e exigem `Authorization: Bearer <token>`.
