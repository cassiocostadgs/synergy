# ✅ tasks.md — Synergy MVP

> Gerado a partir de `PRD.md`, `CLAUDE.md` e `DESIGN-SYSTEM.md` (2026-09-08).
> Escopo: apenas o que está concretamente especificado hoje (RBAC + Épico 3.1 — Gestão de Times e Membros + App Shell). Todos os pontos em aberto foram resolvidos em 2026-09-08 — ver [📌 Decisões de Escopo Confirmadas](#-decisões-de-escopo-confirmadas-2026-09-08).
>
> **Decisões técnicas confirmadas (2026-09-08):**
> - Banco de dados = **PostgreSQL** (via `pgx`/GORM, conforme `CLAUDE.md`).
> - Modelo `Team`/`TeamMember` formalizado no `PRD.md` (seção 4).
> - Papel **Auditor** fica fora do MVP (reservado no enum, sem regras de permissão).
> - Épico **Dashboard/Behavioral Insights** fica pós-MVP (só o componente visual genérico de KPI Card entra agora).

---

## Fase 0 — Fundamento do Monorepo

### Backend (`apps/api`)
- [ ] Inicializar módulo Go (`go mod init`) e estrutura `cmd/api/main.go`
- [ ] Criar esqueleto de camadas em `internal/`: `domain/`, `usecase/`, `repository/`, `handler/`
- [ ] Configurar servidor HTTP (router, middlewares de log e recovery)
- [ ] Configurar conexão com **PostgreSQL** (pgx/GORM) via variáveis de ambiente
- [ ] Configurar sistema de migrations (ex: `golang-migrate` ou `atlas`)
- [ ] Middleware de autenticação (JWT) e middleware de autorização por `Role`
- [ ] Padronizar formato de erro/response HTTP (envelope de DTO)
- [ ] Configurar CORS para consumo pelo `apps/web`

### Frontend (`apps/web`)
- [ ] Inicializar projeto Vite + React + TypeScript
- [ ] Configurar Tailwind CSS com tokens do tema **Neon Tokyo** (cores, fontes, dark mode obrigatório)
- [ ] Instalar/configurar Shadcn (base de `components/`)
- [ ] Configurar fonte `Sora` (Google Fonts ou self-host)
- [ ] Estrutura de pastas: `components/`, `features/`, `services/`, `types/`
- [ ] Cliente HTTP global (Axios) em `services/` com interceptor de auth
- [ ] Roteamento (React Router) com rotas protegidas por `Role`

### DevOps / Qualidade
- [ ] Lint + format (ESLint/Prettier no front, `golangci-lint` no back)
- [ ] Pipeline de CI básico (build + testes) para os dois apps
- [ ] `.env.example` para API e Web

---

## Fase 1 — Modelo de Dados e Autenticação

- [ ] Modelar entidade `User` (id, name, email, role, timestamps)
- [ ] Modelar entidade `Profile` (userId, hobby, xp, level) — 1:1 com `User`
- [ ] Modelar entidades `Team` e `TeamMember` (formalizadas no `PRD.md`, seção 4)
  - `Team`: id, nome, `status` (`TeamStatus`: ACTIVE/ARCHIVED), timestamps
  - `TeamMember`: teamId, userId, `role` (`TeamRole`: GESTOR_PRINCIPAL/GESTOR_APOIO/COLABORADOR)
- [ ] Migrations correspondentes
- [ ] Endpoint de login/autenticação (emissão de JWT)
- [ ] Seed inicial (usuário Admin) para bootstrap do sistema

---

## Fase 2 — RBAC (Admin / Gestor / Colaborador)

- [ ] Definir enum `Role` no domínio com os 4 valores do PRD (`ADMIN`, `GESTOR`, `COLABORADOR`, `AUDITOR`), mas implementar regras de autorização **apenas** para os 3 primeiros — `AUDITOR` fica reservado, fora do MVP
- [ ] Usecase de checagem de permissão por papel e por escopo (ex: Gestor só age no próprio time)
- [ ] Handler + middleware para proteger rotas por papel
- [ ] Frontend: guard de rotas (`RequireRole`) e ocultação condicional de ações na UI conforme papel

---

## Fase 3 — Épico: Gestão de Times e Membros

### Regras de negócio a implementar
- [ ] **RN1:** todo time deve ter exatamente 1 Gestor Principal e no máximo 1 Gestor de Apoio
  - [ ] Validação no usecase de criação/edição de time (bloquear 2º Gestor Principal, 3º gestor, etc.)
  - [ ] Validação de transferência de papel de Gestor Principal (não pode ficar sem nenhum)
- [ ] **RN2:** apenas Gestores do próprio time controlam entrada de novos colaboradores
  - [ ] Usecase de adicionar/aprovar membro restrito a Gestores daquele `teamId`

### Backend
- [ ] `domain`: interfaces de repositório de `Team`/`TeamMember`
- [ ] `usecase`: criar time, editar time, arquivar time
- [ ] `usecase`: adicionar membro, alterar papel do membro, remover membro
- [ ] `repository`: implementação SQL das interfaces acima
- [ ] `handler`: endpoints REST (CRUD de time + gestão de membros) e DTOs de request/response
- [ ] Testes de unidade das regras RN1/RN2 no `usecase`

### Frontend (`features/teams`)
- [ ] `api/`: chamadas HTTP (listar, criar, editar, arquivar time; gerenciar membros)
- [ ] `hooks/`: hooks de dados (ex: `useTeams`, `useTeamMembers`) com cache/estado de loading
- [ ] `ui/`: tela de listagem de times
- [ ] `ui/`: formulário de criação/edição de time
- [ ] `ui/`: painel de membros do time (tabela — ver padrão 4.3 do Design System)
  - [ ] Ações: adicionar, alterar papel, remover membro
  - [ ] Badges de papel (`GESTOR_PRINCIPAL` / `GESTOR_APOIO` / `COLABORADOR`) e status do time (`ACTIVE`/`ARCHIVED`)
- [ ] Validações de formulário espelhando RN1/RN2 (feedback antes do submit)

---

## Fase 4 — App Shell (Design System "Neon Tokyo")

- [ ] `SideNavBar` (w-64, fixa, `bg-surface-container-low`, logo "Synergy" + subtítulo, ícones Material Symbols, estado ativo com glow)
- [ ] Rodapé da sidebar com ações rápidas (ex: Logout, Help)
- [ ] `TopNavBar` (sticky, `justify-between`, navegação central, avatar/ notificações à direita)
- [ ] Layout responsivo: `BottomNavBar` flutuante para mobile
- [ ] Componente `KPI Card` genérico (glassmorphism + glow) reutilizável em `components/`
- [ ] Tema dark obrigatório aplicado globalmente (paleta: `#0d1515`→`#071010` fundo, `#ff2d78` primário, `#00ffff` secundário)
- [ ] Tela de perfil do usuário exibindo XP/Level (consumindo `Profile`) — exposição mínima do dado que já existe no schema

---

## Fase 5 — QA e Fechamento do MVP

- [ ] Testes de integração dos endpoints de Times/Membros (happy path + violações de RN1/RN2)
- [ ] Testes de componente das telas de `features/teams`
- [ ] Revisão de acessibilidade e contraste (tema dark com acentos neon)
- [ ] Revisão de RBAC (tentar acessar ações fora do papel via API diretamente)
- [ ] Deploy de ambiente de homologação

---

## 📌 Decisões de Escopo Confirmadas (2026-09-08)

Todos os pontos que estavam em aberto na primeira versão deste documento foram decididos com o time de produto:

1. **Papel Auditor → fora do MVP.** O enum `Role` mantém o valor `AUDITOR` (reservado para fase futura), mas nenhuma regra de permissão é implementada para ele agora. Registrado no `PRD.md`, seção 2.
2. **Modelo `Team`/`TeamMember` → formalizado.** Ficou definido com `TeamRole` (`GESTOR_PRINCIPAL`/`GESTOR_APOIO`/`COLABORADOR`) e `TeamStatus` (`ACTIVE`/`ARCHIVED`), incorporado ao `PRD.md`, seção 4.
3. **Épico Dashboard/Behavioral Insights → pós-MVP.** O `DESIGN-SYSTEM.md` já desenha esses componentes, mas nenhuma regra de negócio real entra neste MVP; apenas o componente visual genérico de KPI Card é construído (Fase 4), sem dado de produto por trás. Registrado no `PRD.md`, seção 5 ("Fora do Escopo do MVP").
4. **Metas (Goal) e Dinâmicas Management 3.0 → pós-MVP** (decisão já confirmada anteriormente). Existiam numa versão anterior do PRD (commit `a644303`: `git show a644303:PRD.md`) e podem servir de ponto de partida quando esses épicos forem retomados. Registrado no `PRD.md`, seção 5.

Não há mais pontos em aberto bloqueando o início da implementação das Fases 0–5 acima.

---

## 🛠️ Nota de infraestrutura (fora do escopo de produto)

Foram detectados **2 commits no repositório que não foram feitos por mim** durante esta sessão (`096dc94`, `1556935`). Isso sugere algum auto-commit (extensão do VS Code, hook de git, etc.) rodando no ambiente. Vale revisar as configurações do editor/repositório para confirmar se isso é intencional — commits automáticos podem gravar estados intermediários sem revisão.
