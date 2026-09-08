# 📄 Product Requirements Document (PRD) — Synergy

## 1. Visão Geral do Produto
**Synergy** é um hub de engajamento e gestão para equipes de desenvolvimento de software operando em modelo remoto. A plataforma combina práticas do **Management 3.0** com mecanismos de **Gamificação** para transformar o alinhamento de metas, o acompanhamento de progresso e a cultura do time em uma experiência dinâmica, clara e motivadora.

* **Problema:** Times remotos enfrentam desconexão interpessoal, falta de visibilidade sobre conquistas e baixa motivação em processos tradicionais de gestão.
* **Solução:** Uma plataforma centralizada onde gestores orquestram dinâmicas colaborativas, mantêm visibilidade de métricas humanas e recompensam o atingimento de metas com elementos lúdicos. 

---

## 2. Matriz de Atores e Permissões (RBAC)

O MVP conta com 3 perfis de usuários com escopos de ação específicos:

| Papel | Descrição | Permissões Principais |
| :--- | :--- | :--- |
| **Admin** | Administrador global | Criar organizações, gerenciar acessos globais e configurar parâmetros do sistema. |
| **Gestor (Líder)** | Líder do time (*Máx. 2 por time: 1 Principal e 1 Apoio*) | Adicionar/remover membros, criar/avaliar metas, iniciar dinâmicas e visualizar perfis/métricas do time. |
| **Colaborador** | Desenvolvedor/Membro técnico | Acessar perfil próprio (nível, XP, conquistas), gerenciar suas metas e participar das dinâmicas ativas. |

> Um 4º papel, **Auditor** (acesso somente leitura), está reservado no enum `Role` (seção 4) para uma fase futura — está **fora do escopo deste MVP** e não deve ter regras de autorização implementadas agora.

---

## 3. Módulos e Funcionalidades (Épicos)

### 3.1. Gestão de Times e Membros
* **Regra de Negócio 1:** Todo time deve possuir exatamente 1 Gestor Principal e pode ter até 1 Gestor de Apoio (Co-Líder).
* **Regra de Negócio 2:** O acesso de novos colaboradores ao time é controlado exclusivamente pelos Gestores do próprio time.
* **Funcionalidades:**
  * Cadastro, edição e arquivamento de times.
  * Painel de membros para adição, alteração de função (Papel) ou remoção.
  

---

## 4. Estrutura de Dados Preliminar

> **Banco de dados:** PostgreSQL (acessado via GORM/pgx no backend, conforme `CLAUDE.md`).


enum Role {
  ADMIN
  GESTOR
  COLABORADOR
  AUDITOR
}

model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  role      Role     @default(COLABORADOR)
  profile   Profile?
  createdAt DateTime @default(now())
}

model Profile {
  id     String  @id @default(uuid())
  userId String  @unique
  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  hobby  String?
  xp     Int     @default(0)
  level  Int     @default(1)
}

enum TeamRole {
  GESTOR_PRINCIPAL
  GESTOR_APOIO
  COLABORADOR
}

enum TeamStatus {
  ACTIVE
  ARCHIVED
}

model Team {
  id        String       @id @default(uuid())
  name      String
  status    TeamStatus   @default(ACTIVE)
  members   TeamMember[]
  createdAt DateTime     @default(now())
}

model TeamMember {
  id       String   @id @default(uuid())
  teamId   String
  userId   String
  role     TeamRole @default(COLABORADOR)
  team     Team     @relation(fields: [teamId], references: [id])
  user     User     @relation(fields: [userId], references: [id])

  @@unique([teamId, userId])
}

---

## 5. Fora do Escopo do MVP

Itens abaixo foram deliberadamente descopados desta primeira entrega (decisões de 2026-09-08). Ficam registrados aqui para não serem confundidos com lacunas do PRD:

* **Papel Auditor:** reservado no enum `Role`, sem regras de permissão implementadas no MVP.
* **Dashboard / Behavioral Insights:** o `DESIGN-SYSTEM.md` já especifica os componentes visuais (KPI Cards, grade de insights comportamentais), mas nenhuma regra de negócio, fonte de dado ou tela real entra neste MVP — apenas o componente de KPI Card genérico é construído, sem dado de produto por trás.
* **Módulo de Metas (Goal):** avaliação e acompanhamento de metas citados na visão geral e na matriz de RBAC, mas sem modelo de dados nem épico detalhado nesta versão.
* **Dinâmicas Management 3.0:** inclui práticas como Moving Motivators, Kudo Box, Niko-Niko e Personal Map — citadas na visão geral, mas sem épico nesta versão do PRD.