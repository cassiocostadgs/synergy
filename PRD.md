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
  * No cadastro de um usuário, o Admin pode já vinculá-lo a um time ativo (opcional), escolhendo o papel de Colaborador ou Gestor de Apoio.

### 3.2. Dinâmicas e Facilitação

Módulo de ferramentas para conduzir rituais do time. Substitui o épico "Dinâmicas
Management 3.0" que estava integralmente fora de escopo: as duas primeiras ferramentas
saíram, as práticas nomeadas continuam pendentes de especificação.

> **Feature em avaliação (2026-09-09):** entra no produto para medir aderência. Se não
> for adotada, será removida. A ausência de persistência é deliberada e mantém a remoção
> barata — não há dado de usuário a migrar ou descartar.

#### 3.2.1. Sorteio de Temas — **entregue**

Roleta para escolher aleatoriamente o tema de uma conversa (retro, daily, reunião de time).

* **Funcionalidades:**
  * Lista de temas digitada na hora, um por linha, **sem persistência** — vale apenas para a sessão em uso.
  * Roda visual com o resultado destacado.
* **Regras de Negócio:**
  * Cada tema aceita no máximo **20 caracteres**.
  * A lista exige de **2 a 24 temas**; acima disso os setores da roda ficam ilegíveis.
  * Temas repetidos são rejeitados, pois duplicata enviesa o sorteio.
  * O sorteio é **uniforme** e o vencedor é definido **antes** da animação — a roda é girada até ele. O caminho inverso (ler o ângulo final para descobrir o vencedor) pode exibir um setor diferente do resultado anunciado.
* **Acesso:** hoje disponível a **qualquer usuário autenticado**, sem restrição de papel — decisão a revisar se o módulo for adotado.

#### 3.2.2. Brackets — **entregue**

Chaveamento de eliminação simples para o time decidir "o melhor" de um tema por votação
sucessiva (ex: *melhor filme de todos os tempos*).

* **Funcionalidades:**
  * Informar um **tema** (até 60 caracteres) e as **opções**, uma por linha, **sem persistência** — a chave vive na tela e se perde ao recarregar.
  * Embaralhar os confrontos da primeira rodada (opcional, ligado por padrão).
  * Decidir cada confronto com **um clique**, até restar o campeão.
  * Rodadas nomeadas conforme o tamanho (Oitavas, Quartas, Semifinal, Final).
* **Regras de Negócio:**
  * De **2 a 16 opções**, com até **40 caracteres** cada; opções repetidas são rejeitadas.
  * **Byes:** quando o número de opções não é potência de 2, a chave cresce até a próxima potência e a diferença vira passagem direta na primeira rodada. Com 5 opções, a chave tem 8 posições e 3 byes. A tela informa quantos byes haverá **antes** de criar a chave.
  * Como a ordem é embaralhada, quem recebe bye é definido por sorteio.
  * O total de confrontos é sempre **nº de opções − 1**.
  * **Trocar um vencedor invalida o que dependia dele:** ao voltar e mudar a decisão de um confronto anterior, as escolhas seguintes que envolviam o participante removido deixam de valer automaticamente. A chave é derivada das escolhas, não mutada.
* **Acesso:** qualquer usuário autenticado, como o Sorteio de Temas.

#### 3.2.3. Práticas Management 3.0 — **não especificadas**

Kudo Box, Niko-Niko, Personal Map e Moving Motivators seguem sem regra de negócio, modelo
de dados ou tela. Ver seção 5.

### 3.3. Autogestão de Conta

Disponível a **qualquer usuário autenticado**, independente do papel — cada pessoa cuida
do próprio cadastro sem depender do Admin.

* **Funcionalidades:**
  * Editar **nome** e **hobby** na tela de perfil.
  * Trocar a **própria senha**, informando obrigatoriamente a senha atual.
  * Escolher no login se a sessão **persiste no dispositivo** ou é encerrada ao fechar o navegador (útil em computador compartilhado).
* **Regras de Negócio:**
  * A nova senha exige no mínimo **8 caracteres** e precisa ser **diferente da atual**.
  * Senha atual incorreta é recusada, sem alterar nada.
  * Nome é obrigatório; nome e hobby aceitam até **120 caracteres**.
* **XP e nível não são exibidos.** Os campos existem no modelo (seção 4) e vêm na resposta de `GET /me`, mas nenhuma regra os altera — todo usuário ficaria permanentemente em "nível 1 / 0 XP". Exibir isso passa impressão de recurso quebrado, então a interface só voltará a mostrá-los quando a Gamificação tiver regras (ver seção 5).
* **Deliberadamente não editáveis pelo próprio usuário:**
  * **E-mail** — é a identidade de login. Trocá-lo sem confirmação permitiria mover a conta para um endereço não controlado pela pessoa, ou colidir com outro cadastro.
  * **Papel global** — seria escalada de privilégio.
  * **XP e nível** — seria burla da gamificação.
* **Limitação conhecida:** trocar a senha **não invalida os tokens já emitidos**; eles seguem válidos até expirar. Revogar sessões exigiria lista de bloqueio ou versionamento de credencial.
* **Fora de escopo:** recuperação de senha por e-mail ("esqueci minha senha") e reset de senha de terceiros pelo Admin. Sem isso, um usuário que perca a senha depende de intervenção direta no banco.

### 3.4. Inativação de Acessos

Exclusivo do **Admin**, na tela de Usuários. Inativar **não exclui**: o vínculo com os
times permanece, preservando o histórico de participação que um `DELETE` destruiria.

* **Funcionalidades:**
  * Inativar e reativar o acesso de qualquer usuário.
  * A listagem mostra a situação de cada um, esmaece os inativos e os joga para o fim da lista.
* **Regras de Negócio:**
  * O usuário inativo **não autentica** e **perde o acesso imediatamente** — a sessão já aberta deixa de valer na requisição seguinte, sem esperar o token expirar.
  * O Admin **não pode inativar o próprio acesso** (se trancaria fora do sistema).
  * Não é possível inativar quem é **Gestor Principal de um time ativo**: a liderança precisa ser transferida antes, senão o time ficaria liderado por alguém sem acesso. Líder de time **arquivado** pode ser inativado.
  * Contrapartida: um usuário inativo **não pode ser adicionado a um time** nem designado Gestor Principal ou de Apoio.
  * O vínculo com os times é preservado na inativação e volta a valer na reativação.
* **Custo assumido:** para a inativação valer na hora, cada requisição autenticada passou a fazer uma leitura do usuário por chave primária. Antes o papel vinha apenas do JWT, sem consultar o banco.

---

## 4. Estrutura de Dados Preliminar

> **Banco de dados:** PostgreSQL (acessado via GORM/pgx no backend, conforme `CLAUDE.md`).
>
> O Sorteio de Temas (3.2.1) e o Brackets (3.2.2) **não possuem modelo de dados**: as listas
> vivem no navegador durante a sessão e nada é gravado.


enum Role {
  ADMIN
  GESTOR
  COLABORADOR
  AUDITOR
}

enum UserStatus {
  ACTIVE
  INACTIVE
}

model User {
  id        String     @id @default(uuid())
  name      String
  email     String     @unique
  role      Role       @default(COLABORADOR)
  status    UserStatus @default(ACTIVE)
  profile   Profile?
  createdAt DateTime   @default(now())
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
* **Gamificação (regras de XP e nível):** os campos `xp` e `level` existem no `Profile` desde a primeira versão, mas **nunca são alterados** — não há regra que defina o que gera XP, quanto vale cada evento, nem a curva de nível. Por isso não são exibidos na interface (seção 3.3). Especificar isso depende de Metas e Dinâmicas, já que os candidatos naturais a gerar XP (meta concluída, participação em dinâmica, kudo recebido) vivem nesses épicos.
* **Práticas Management 3.0 nomeadas:** Moving Motivators, Kudo Box, Niko-Niko e Personal Map continuam sem especificação. O módulo de Dinâmicas (seção 3.2) deixou de estar integralmente fora de escopo — o Sorteio de Temas foi entregue —, mas estas quatro práticas seguem pendentes.
* **Persistência do Sorteio de Temas:** a lista de temas não é salva. Ficam em aberto, caso o módulo prove aderência: temas cadastrados por time, histórico de sorteios (para não repetir tema toda semana) e restrição de quem pode sortear.
* **Recuperação de senha:** não há fluxo de "esqueci minha senha" nem reset pelo Admin (ver seção 3.3). É bloqueador para produção — hoje quem perde a senha depende de alteração direta no banco.
* **Revogação de sessão:** trocar a senha não invalida tokens já emitidos. Exigiria lista de bloqueio ou versionamento de credencial no JWT.