# Synergy — MVP

Hub de engajamento e gestão para times remotos. Este repositório é um monorepo com o
backend em Go (`apps/api`) e o frontend em React (`apps/web`).

O escopo desta entrega é o **Épico 3.1 — Gestão de Times e Membros** com RBAC e o App
Shell do Design System "Neon Tokyo". Metas, Dinâmicas e Dashboard estão fora do MVP
(ver `PRD.md`, seção 5).

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

```bash
cd apps/api
cp .env.example .env   # ajuste DATABASE_URL e JWT_SECRET

# cria o usuário Admin inicial (bootstrap: só o Admin cadastra usuários)
go run ./cmd/seed

# sobe a API em http://localhost:8080
go run ./cmd/api
```

Testes das regras de negócio (RN1/RN2), sem necessidade de banco:

```bash
go test ./...
```

## 3. Frontend (`apps/web`)

```bash
cd apps/web
cp .env.example .env   # VITE_API_URL aponta para a API
npm install
npm run dev            # http://localhost:5173
```

Acesse com o usuário criado no seed (padrão: `admin@synergy.dev`).

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
| POST | `/api/v1/auth/login` | público |
| GET | `/api/v1/me` | autenticado |
| GET | `/api/v1/users` | Admin, Gestor |
| POST | `/api/v1/users` | Admin |
| GET | `/api/v1/teams` | autenticado (Admin vê todos) |
| POST | `/api/v1/teams` | Admin, Gestor |
| GET | `/api/v1/teams/{teamId}` | membros do time / Admin |
| PATCH | `/api/v1/teams/{teamId}` | Gestores do time / Admin |
| POST | `/api/v1/teams/{teamId}/archive` | Gestores do time / Admin |
| GET | `/api/v1/teams/{teamId}/members` | membros do time / Admin |
| POST | `/api/v1/teams/{teamId}/members` | Gestores do time / Admin |
| PATCH | `/api/v1/teams/{teamId}/members/{userId}` | Gestores do time / Admin |
| DELETE | `/api/v1/teams/{teamId}/members/{userId}` | Gestores do time / Admin |
| POST | `/api/v1/teams/{teamId}/transfer-principal` | Gestor Principal / Admin |

Todas as respostas usam o envelope `{ "data": … }` ou `{ "error": { "code", "message" } }`.
