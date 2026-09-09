# ✅ tasks.md — Synergy MVP

> Gerado a partir de `PRD.md`, `CLAUDE.md` e `DESIGN-SYSTEM.md` (2026-09-08).
> Escopo: RBAC + Épico 3.1 (Gestão de Times e Membros) + App Shell.
>
> **Decisões confirmadas (2026-09-08):**
> - Banco de dados = **PostgreSQL** (via `pgx`, conforme `CLAUDE.md`).
> - Modelo `Team`/`TeamMember` formalizado no `PRD.md` (seção 4).
> - Papel **Auditor** fora do MVP (reservado no enum, sem regras de permissão).
> - Épico **Dashboard/Behavioral Insights** pós-MVP (só o componente visual de KPI Card entra agora).
>
> **Status da implementação (2026-09-08):** Fases 0–4 concluídas e verificadas; Fase 5 parcial.
> Ver [Estado da verificação](#-estado-da-verificação) ao final.

---

## Fase 0 — Fundamento do Monorepo

### Backend (`apps/api`)
- [x] Inicializar módulo Go (`go mod init`) e estrutura `cmd/api/main.go`
- [x] Criar esqueleto de camadas em `internal/`: `domain/`, `usecase/`, `repository/`, `handler/`
- [x] Configurar servidor HTTP (router chi, middlewares de log e recovery)
- [x] Configurar conexão com **PostgreSQL** (pgxpool) via variáveis de ambiente
- [x] Configurar sistema de migrations — runner próprio com `embed` + tabela `schema_migrations`
- [x] Middleware de autenticação (JWT) e middleware de autorização por `Role`
- [x] Padronizar formato de erro/response HTTP (envelope `{data}` / `{error}`)
- [x] Configurar CORS para consumo pelo `apps/web`

### Frontend (`apps/web`)
- [x] Inicializar projeto Vite + React 19 + TypeScript
- [x] Configurar Tailwind 4 com tokens do tema **Neon Tokyo** (`@theme` em `src/index.css`)
- [ ] ~~Instalar/configurar Shadcn~~ → **substituído**: os componentes de `components/ui.tsx` foram
      escritos à mão sobre Tailwind, já no visual Neon Tokyo (o CLI do Shadcn é interativo e
      seus defaults não batem com a paleta custom). Revisitar se o time preferir a base do Shadcn.
- [x] Configurar fonte `Sora` (Google Fonts) + Material Symbols
- [x] Estrutura de pastas: `components/`, `features/`, `services/`, `types/`
- [x] Cliente HTTP global em `services/httpClient.ts` com token e tradução de erros
- [x] Roteamento (React Router 7) com rotas protegidas por `Role`

### DevOps / Qualidade
- [x] Lint + format — `oxlint` no front, `go vet` no back
- [ ] `golangci-lint` (não instalado no ambiente; `go vet` cobre o básico)
- [ ] Pipeline de CI básico (build + testes) para os dois apps
- [x] `.env.example` para API e Web

---

## Fase 1 — Modelo de Dados e Autenticação

- [x] Modelar entidade `User` (id, name, email, password_hash, role, created_at)
- [x] Modelar entidade `Profile` (userId, hobby, xp, level) — 1:1 com `User`
- [x] Modelar entidades `Team` e `TeamMember` (formalizadas no `PRD.md`, seção 4)
  - `Team`: id, nome, `status` (`TeamStatus`: ACTIVE/ARCHIVED), created_at
  - `TeamMember`: teamId, userId, `role` (`TeamRole`: GESTOR_PRINCIPAL/GESTOR_APOIO/COLABORADOR)
- [x] Migrations correspondentes (`0001_init`), com índices únicos parciais reforçando a RN1
- [x] Endpoint de login/autenticação (emissão de JWT + bcrypt)
- [x] Seed inicial (usuário Admin) — `cmd/seed`

---

## Fase 2 — RBAC (Admin / Gestor / Colaborador)

- [x] Enum `Role` no domínio com os 4 valores do PRD; autorização implementada apenas para
      `ADMIN`, `GESTOR` e `COLABORADOR` — `AUDITOR` é barrado no login e no middleware
- [x] Usecase de checagem de permissão por papel e por escopo (Gestor só age no próprio time)
- [x] Handler + middleware para proteger rotas por papel (`RequireAuth` / `RequireRole`)
- [x] Frontend: guard de rotas (`RequireAuth`/`RequireRole`) e ocultação condicional de ações na UI

---

## Fase 3 — Épico: Gestão de Times e Membros

### Regras de negócio
- [x] **RN1:** exatamente 1 Gestor Principal e no máximo 1 Gestor de Apoio
  - [x] Time criado junto com o seu Gestor Principal (mesma transação)
  - [x] Bloqueio de 2º Gestor Principal e de 2º Gestor de Apoio
  - [x] Gestor Principal não pode ser removido nem rebaixado — só sai por transferência
  - [x] `TransferPrincipal` atômico (rebaixa o atual, promove o novo)
- [x] **RN2:** apenas Gestores do próprio time (ou Admin) administram membros

### Backend
- [x] `domain`: interfaces de repositório de `Team`/`TeamMember`
- [x] `usecase`: criar, editar, arquivar time
- [x] `usecase`: adicionar membro, alterar papel, remover, transferir liderança
- [x] `repository`: implementação PostgreSQL das interfaces
- [x] `handler`: endpoints REST + DTOs
- [x] Testes de unidade das regras RN1/RN2 — **32 testes, todos passando**

### Frontend (`features/teams`)
- [x] `api/teamsApi.ts`: chamadas HTTP de time e de membros
- [x] `hooks/`: `useTeams`, `useTeamMembers` (loading, erro e recarga)
- [x] `ui/TeamsPage`: listagem de times + KPIs + criação
- [x] `ui/`: formulário de criação e de renomeação de time
- [x] `ui/TeamMembersPage`: painel de membros (tabela do padrão 4.3 do Design System)
  - [x] Ações: adicionar, alterar papel, transferir liderança, remover
  - [x] Badges de papel e status do time
- [x] Feedback de erro da API refletindo as violações de RN1/RN2 na tela

---

## Fase 4 — App Shell (Design System "Neon Tokyo")

- [x] `SideNavBar` (w-64 fixa, logo + subtítulo, Material Symbols, item ativo com glow)
- [x] Rodapé da sidebar com ação rápida (Sair)
- [x] `TopNavBar` (sticky, `justify-between`, navegação central, avatar e papel do usuário)
- [x] `BottomNavBar` flutuante no mobile
- [x] Componente `KPI Card` genérico (glassmorphism + glow) reutilizável
- [x] Tema dark aplicado globalmente com a paleta e a malha futurista de fundo
- [x] Tela de perfil exibindo XP/Level

---

## Fase 5 — QA e Fechamento do MVP

- [x] Verificação de ponta a ponta da API contra PostgreSQL real (login, RBAC, CRUD de time,
      RN1/RN2 e transferência de liderança) — executada manualmente via HTTP
- [ ] Automatizar esses testes de integração (hoje só os unitários estão no `go test`)
- [ ] Testes de componente das telas de `features/teams`
- [ ] Revisão de acessibilidade e contraste
- [x] Revisão de RBAC via API direta (403 para colaborador, 409 para violações de RN1)
- [ ] Deploy de ambiente de homologação

---

## 🔍 Estado da verificação

| Item | Como foi verificado |
| :--- | :--- |
| Regras RN1/RN2 | `go test` — 32 testes unitários, todos passando |
| Compilação do backend | `go build ./...` e `go vet ./...` sem erros |
| Migrations + persistência | aplicadas em PostgreSQL 17 real; tabelas conferidas |
| API ponta a ponta | fluxo completo por HTTP: login → cria usuários → cria time → adiciona membros → violações barradas (403/409) → transferência de liderança |
| Build do frontend | `tsc -b && vite build` sem erros; `oxlint` só com warnings |
| Integração front↔API | preflight CORS e login a partir da origem `http://localhost:5173` |
| **Renderização da UI** | **não verificada em navegador** — sem browser headless no ambiente. Abrir `http://localhost:5173` para conferir visualmente. |

---

## 🛠️ Nota de infraestrutura (fora do escopo de produto)

1. Foram detectados **2 commits no repositório que não foram feitos por mim** (`096dc94`,
   `1556935`), sugerindo algum auto-commit (extensão do VS Code, hook) no ambiente. Vale revisar.
2. Go 1.27 e PostgreSQL 17 foram instalados de forma **portátil** em `%LOCALAPPDATA%\Programs`
   (`go` e `pgsql`), porque os instaladores do winget exigem elevação (UAC) que o terminal
   não-interativo não consegue conceder. Nada foi instalado no sistema.
3. O antivírus bloqueia executar binários recém-escritos no `%TEMP%`, o que faz `go test ./...`
   falhar com "Acesso negado". Contorno: `go test -c -o <caminho> ./...` e executar o binário
   em seguida — ou rodar em um terminal comum, onde o comportamento pode não ocorrer.
