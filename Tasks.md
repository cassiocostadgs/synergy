# ✅ tasks.md — Synergy MVP

> Gerado a partir de `PRD.md`, `CLAUDE.md` e `DESIGN-SYSTEM.md` (2026-09-08).
> Escopo: apenas o que está concretamente especificado hoje (RBAC + Épico 3.1 — Gestão de Times e Membros + App Shell). Ver [⚠️ Pontos em aberto no PRD](#️-pontos-em-aberto-no-prd-resolver-antes-ou-durante-o-mvp) antes de estimar o restante do MVP.

---

## Fase 0 — Fundamento do Monorepo

### Backend (`apps/api`)
- [ ] Inicializar módulo Go (`go mod init`) e estrutura `cmd/api/main.go`
- [ ] Criar esqueleto de camadas em `internal/`: `domain/`, `usecase/`, `repository/`, `handler/`
- [ ] Configurar servidor HTTP (router, middlewares de log e recovery)
- [ ] Configurar conexão com banco (pgx/GORM) via variáveis de ambiente
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
- [ ] Modelar entidades `Team` e `TeamMember` (necessárias para o Épico 3.1, ausentes no PRD — ver pontos em aberto)
  - `Team`: id, nome, status (ativo/arquivado), timestamps
  - `TeamMember`: teamId, userId, papel-no-time (Gestor Principal / Gestor de Apoio / Colaborador)
- [ ] Migrations correspondentes
- [ ] Endpoint de login/autenticação (emissão de JWT)
- [ ] Seed inicial (usuário Admin) para bootstrap do sistema

---

## Fase 2 — RBAC (Admin / Gestor / Colaborador)

- [ ] Definir enum `Role` no domínio (alinhar com decisão sobre `AUDITOR` — ver pontos em aberto)
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
  - [ ] Badges de papel (Gestor Principal / Apoio / Colaborador) e status
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

## ⚠️ Pontos em aberto no PRD (resolver antes ou durante o MVP)

1. **Papéis divergentes:** a matriz RBAC (seção 2) lista só `Admin`, `Gestor`, `Colaborador`, mas o enum `Role` (seção 4) inclui `AUDITOR`. Precisa decidir se Auditor entra no MVP e quais suas permissões.
2. **Modelo de dados incompleto para o próprio épico do MVP:** a seção 4 só define `User` e `Profile`; não há `Team`/`TeamMember`, indispensáveis para a seção 3.1. Assumi um modelo mínimo acima — validar com o time antes de implementar.
3. **Épicos prometidos e não escritos:** o título da seção 3 é "Módulos e Funcionalidades (**Épicos**)" no plural, mas só o 3.1 existe. O Design System já pressupõe telas de Dashboard/KPIs e "Behavioral Insights" (seção 4.1–4.2) que não têm nenhuma regra de negócio ou funcionalidade descrita no PRD — não incluí tarefas de implementação de dados para eles, só o componente visual genérico (KPI Card), para não inventar escopo.
4. **Gamificação:** o Overview cita "mecanismos de Gamificação" e o `Profile` já tem `xp`/`level`, mas não há regra de como XP é ganho, o que dispara level up, nem o que são as "dinâmicas" (Gestor "inicia dinâmicas" — seção 2). Isso é provavelmente um épico próprio ainda não escrito.
5. **Metas:** Gestores "criam/avaliam metas" e Colaboradores "gerenciam suas metas" (seção 2), mas não há épico, modelo de dados nem tela para Metas no PRD atual.

Recomendo tratar os itens 3–5 como próximos épicos a especificar no PRD antes de virarem tasks — do jeito que está, qualquer tarefa para eles seria suposição minha, não requisito do produto.
