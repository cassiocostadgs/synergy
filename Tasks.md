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
> **Revisão de escopo (2026-09-09):** o épico de **Dinâmicas** deixou de estar integralmente
> fora do MVP. O **Sorteio de Temas** entrou como *feature em avaliação* — se não tiver
> aderência, será removida; foi entregue sem persistência de propósito, o que mantém a
> remoção barata. Ver Fase 4.1 e `PRD.md` seção 3.2. As quatro práticas nomeadas (Kudo Box,
> Niko-Niko, Personal Map e Moving Motivators) e o módulo de **Metas** continuam fora de escopo.
>
> **Status da implementação (2026-09-09):** Fases 0–4.1 concluídas e verificadas; Fase 5 parcial.
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
- [x] `ui/TeamMembersPage`: painel de membros (tabela do padrão 4.4 do Design System)
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
- [x] ~~Tela de perfil exibindo XP/Level~~ → **revertido em 2026-09-09.** Os widgets de nível,
      experiência e barra de progresso foram removidos do perfil (e o "Nível N" do cabeçalho):
      nenhum caminho de código altera XP ou nível, então todo usuário exibiria "nível 1 / 0 XP"
      para sempre, e a régua de progresso era um valor arbitrário meu, não regra de produto.
      O dado continua no banco e em `GET /me`; a tela volta quando a Gamificação for especificada.

---

## Fase 4.1 — Épico: Dinâmicas e Facilitação (PRD seção 3.2)

Escopo entrou depois do planejamento inicial, como **feature em avaliação**: se não houver
aderência, é removida. Por isso nasceu sem persistência — a remoção não deixa dado órfão.

### Sorteio de Temas — concluído
- [x] Rota `/sorteio` e item "Sorteio" no menu lateral (visível a todos os papéis)
- [x] Roleta em SVG com a paleta neon, ponteiro fixo e resultado destacado
- [x] Vencedor sorteado **antes** da animação; a roda gira até ele
  - [x] Verificado por cálculo independente: 897 casos (2–24 temas, 3 rodadas), zero divergência entre o sorteado e o setor sob o ponteiro
  - [x] Rotação sempre progride para frente entre sorteios
  - [x] Distribuição uniforme conferida (300 mil sorteios, desvio máximo 0,32%)
- [x] Validações: até 20 caracteres por tema, de 2 a 24 temas, sem repetidos, linhas vazias ignoradas
- [x] Rótulos invertidos na metade esquerda da roda e fonte proporcional à quantidade de setores
- [x] Roda congelada durante o giro (editar o texto no meio da animação não faz o resultado divergir do desenho)
- [x] Acessibilidade: resultado anunciado via `aria-live`; `prefers-reduced-motion` entrega o resultado sem animação, com aviso na tela

### Pendências, caso o módulo prove aderência
- [ ] Decidir quem pode sortear (hoje é qualquer usuário autenticado, sem restrição de papel)
- [ ] Temas cadastrados por time, para não redigitar a cada ritual
- [ ] Histórico de sorteios (evitar repetir tema toda semana)
- [ ] Testes automatizados da fórmula de rotação e das validações (hoje verificados por script pontual, fora da suíte)

### Práticas Management 3.0 — fora de escopo
- [ ] Kudo Box, Niko-Niko, Personal Map e Moving Motivators seguem sem regra de negócio, modelo de dados ou tela (PRD seção 5)

---

## Fase 4.2 — Autogestão de Conta (PRD seção 3.3)

- [x] `PATCH /api/v1/me` — usuário edita nome e hobby próprios
- [x] `PATCH /api/v1/me/password` — troca da própria senha exigindo a atual
- [x] `domain`: `UpdateName`, `UpdatePassword` e `UpdateHobby` nas interfaces de repositório
- [x] `repository`: implementação PostgreSQL dos três métodos
- [x] `usecase`: `UpdateMe` e `ChangePassword`, com as validações (nome obrigatório, 120 caracteres, senha mínima de 8, nova diferente da atual)
- [x] E-mail, papel global e XP fora do que o próprio usuário pode alterar (`UpdateMeInput` não expõe esses campos)
- [x] Frontend: formulários de dados e de senha na tela de perfil
- [x] Frontend: "Manter sessão neste dispositivo" no login — `localStorage` quando marcado, `sessionStorage` quando não
- [x] Frontend: Credential Management API para o navegador oferecer salvar a senha (Chrome/Edge; degrada silenciosamente onde não há suporte)
- [x] **19 testes unitários** novos de autenticação, perfil e cadastro (total do backend: **51**)

### Pendências relacionadas
- [ ] Recuperação de senha por e-mail ("esqueci minha senha") — **bloqueador para produção**
- [ ] Reset de senha de terceiros pelo Admin
- [ ] Revogação de sessão ao trocar a senha (hoje os tokens emitidos seguem válidos até expirar)
- [ ] Troca de e-mail com fluxo de confirmação

---

## Fase 4.3 — Inativação de Acessos (PRD seção 3.4)

- [x] Migration `0002_user_status`: enum `user_status`, coluna `status` com default `ACTIVE` e índice
- [x] `domain`: `UserStatus`, `User.Status`, `User.IsActive()`, `UpdateStatus` e `LeadsActiveTeam`
- [x] `repository`: implementação PostgreSQL, com listagem ordenando ativos primeiro
- [x] `usecase.SetUserStatus` — restrito ao Admin, com as guardas:
  - [x] Admin não inativa o próprio acesso
  - [x] não inativa Gestor Principal de time **ativo** (líder de time arquivado pode)
  - [x] usuário inativo não entra em time nem lidera (contrapartida em `AddMember` e `assertCanBePrincipal`)
  - [x] vínculos com times preservados na inativação
- [x] **Revogação imediata:** `EnsureActive` é consultado pelo middleware em cada requisição autenticada — o token já emitido para de valer na hora, sem esperar expirar
- [x] `PATCH /api/v1/users/{userId}/status` (Admin) e `status` no DTO de usuário
- [x] Frontend: coluna de situação, linhas de inativos esmaecidas, botões Inativar/Reativar com confirmação, contagem de inativos no subtítulo
- [x] Frontend: usuários inativos filtrados dos seletores de membro e de Gestor Principal
- [x] **10 testes unitários** novos (total do backend: **61**)

### Decisão registrada
O middleware passou a consultar o banco por requisição (leitura por chave primária). Era a
alternativa a uma inativação que só surtiria efeito quando o token expirasse — para uma ação
de segurança, atraso de horas equivale a não funcionar.

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
| Regras RN1/RN2 | 32 testes unitários, todos passando |
| Autenticação, perfil e cadastro | 19 testes unitários (login, `UpdateMe`, `ChangePassword`, `CreateUser`) — **51 no total**, todos passando |
| Autogestão ponta a ponta | fluxo real por HTTP com um Colaborador: edição de nome/hobby com trim, validações (400/401), troca de senha e confirmação de que a nova autentica e a antiga não |
| Compilação do backend | `go build ./...` e `go vet ./...` sem erros |
| Migrations + persistência | aplicadas em PostgreSQL 17 real; tabelas conferidas |
| API ponta a ponta | fluxo completo por HTTP: login → cria usuários → cria time → adiciona membros → violações barradas (403/409) → transferência de liderança |
| Build do frontend | `tsc -b && vite build` sem erros; `oxlint` só com warnings |
| Integração front↔API | preflight CORS e login a partir da origem `http://localhost:5173` |
| Sorteio de Temas — rotação | script independente: 897 casos (2–24 temas, 3 rodadas), zero divergência entre o vencedor sorteado e o setor sob o ponteiro; rotação sempre progressiva |
| Sorteio de Temas — distribuição | 300 mil sorteios com 5 temas, desvio máximo de 0,32% |
| Sorteio de Temas — validações | 9 casos de borda conferidos (limite exato de 20 caracteres, mínimo, máximo, duplicados, linhas vazias) |
| Vínculo de time no cadastro | fluxo real por HTTP, incluindo a falha parcial (usuário criado com `201` e vínculo recusado com `409`) |
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
