# 📄 Product Requirements Document (PRD) — Synergy

## 1. Visão Geral do Produto
**Synergy** é um hub de engajamento e gestão para equipes de desenvolvimento de software operando em modelo remoto. A plataforma combina práticas do **Management 3.0** com mecanismos de **Gamificação** para transformar o alinhamento de metas, o acompanhamento de progresso e a cultura do time em uma experiência dinâmica, clara e motivadora.

* **Problema:** Times remotos enfrentam desconexão interpessoal, falta de visibilidade sobre conquistas e baixa motivação em processos tradicionais de gestão.
* **Solução:** Uma plataforma centralizada onde gestores orquestram dinâmicas colaborativas, mantêm visibilidade de métricas humanas e recompensam o atingimento de metas com elementos lúdicos. 

---

## 2. Matriz de Atores e Permissões (RBAC)

O sistema conta com 4 perfis de usuários com escopos de ação específicos:

| Papel | Descrição | Permissões Principais |
| :--- | :--- | :--- |
| **Admin** | Administrador global | Criar organizações, gerenciar acessos globais e configurar parâmetros do sistema. |
| **Gestor (Líder)** | Líder do time (*Máx. 2 por time: 1 Principal e 1 Apoio*) | Adicionar/remover membros, criar/avaliar metas, iniciar dinâmicas e visualizar perfis/métricas do time. |
| **Colaborador** | Desenvolvedor/Membro técnico | Acessar perfil próprio (nível, XP, conquistas), gerenciar suas metas e participar das dinâmicas ativas. |
| **Auditor** | Stakeholder / RH / Diretor | Acesso de **somente leitura** (*Read-Only*) a todas as visões do Gestor de Time. Não pode alterar dados. |

---

## 3. Módulos e Funcionalidades (Épicos)

### 3.1. Gestão de Times e Membros
* **Regra de Negócio 1:** Todo time deve possuir exatamente 1 Gestor Principal e pode ter até 1 Gestor de Apoio (Co-Líder).
* **Regra de Negócio 2:** O acesso de novos colaboradores ao time é controlado exclusivamente pelos Gestores do próprio time.
* **Funcionalidades:**
  * Cadastro, edição e arquivamento de times.
  * Painel de membros para adição, alteração de função (Papel) ou remoção.
  * Atribuição da role de **Auditor** ao perfil de visualização sem permissão de escrita.

### 3.3. Dinâmicas Management 3.0
* **Funcionalidades:**
  * **Moving Motivators:** Avaliar os **10 motivadores** para entender o que gera ou reduz a motivação da pessoa, considerando aspectos como **honra, aceitação, curiosidade, domínio, poder, liberdade, relacionamento, ordem, propósito e status**.
.


---

## 4. Estrutura de Dados Preliminar


enum GlobalRole {
  ADMIN
  USER
}

enum TeamRole {
  LEAD
  CO_LEAD
  MEMBER
  AUDITOR
}

enum GoalStatus {
  PENDING
  IN_PROGRESS
  IN_REVIEW
  COMPLETED
}

// 1. NOVO: Enumeração estrita para garantir os tipos de dinâmicas
enum DynamicType {
  KUDO_BOX
  NIKO_NIKO
  PERSONAL_MAP
  MOVING_MOTIVATORS
}

model User {
  id          String       @id @default(uuid())
  name        String
  email       String       @unique
  hobby       String       
  globalRole  GlobalRole   @default(USER)
  xp          Int          @default(0)
  level       Int          @default(1)
  memberships TeamMember[]
  goals       Goal[]       @relation("AssignedGoals")
  dynamics    Dynamic[]    @relation("UserDynamics") // NOVO: Histórico do que o usuário preencheu
}

model Team {
  id          String       @id @default(uuid())
  name        String
  description String?
  members     TeamMember[]
  goals       Goal[]
  dynamics    Dynamic[]
}

model TeamMember {
  id     String   @id @default(uuid())
  teamId String
  userId String
  role   TeamRole @default(MEMBER)
  team   Team     @relation(fields: [teamId], references: [id])
  user   User     @relation(fields: [userId], references: [id])

  @@unique([teamId, userId])
}

model Goal {
  id          String     @id @default(uuid())
  title       String
  description String?
  xpReward    Int        @default(100)
  status      GoalStatus @default(PENDING)
  deadline    DateTime?
  teamId      String
  userId      String?
  team        Team       @relation(fields: [teamId], references: [id])
  assignedTo  User?      @relation("AssignedGoals", fields: [userId], references: [id])
}

model Dynamic {
  id        String      @id @default(uuid())
  type      DynamicType 
  payload   Json        // Onde os dados da dinâmica são salvos
  teamId    String
  userId    String?     // NOVO: Quem gerou/preencheu a dinâmica (Opcional, pois algumas podem ser gerais do time)
  
  team      Team        @relation(fields: [teamId], references: [id])
  user      User?       @relation("UserDynamics", fields: [userId], references: [id])
  
  createdAt DateTime    @default(now())
}