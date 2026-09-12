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

#### 3.2.3. Moving Motivators — **entregue**

Primeira das práticas nomeadas do Management 3.0. Vive **dentro do perfil** de cada pessoa:
não é ferramenta de facilitação efêmera como as duas anteriores, e sim **dado pessoal
persistido**.

* **Funcionalidades:**
  * Cada usuário ordena os **10 motivadores** conforme as próprias prioridades: Curiosidade, Liberdade, Propósito, Maestria, Relações, Honra, Aceitação, Ordem, Poder e Status.
  * Reordenação por **arraste** ou pelas **setas** de cada item.
  * As 3 primeiras posições recebem destaque visual.
  * A resposta é **salva** e exibe a data do último preenchimento.
* **Regras de Negócio:**
  * A resposta exige a **permutação completa dos 10** — não existe ordenação parcial. Aceitar lista incompleta produziria perfis incomparáveis entre pessoas.
  * Motivador repetido ou desconhecido é recusado.
  * Salvar **substitui** a resposta anterior por completo; não há histórico de versões.
  * Quem nunca respondeu recebe a ordem canônica como ponto de partida, marcada como não respondida.
  * **Revisão a cada 90 dias:** motivação muda com o tempo, e uma resposta antiga descreve outra pessoa. A tela mostra há quantos dias a dinâmica foi respondida e quantos faltam para a próxima revisão; ao completar **90 dias** passa a pedir que seja refeita, indicando o atraso. O corte é inclusivo: no 90º dia já vence.
  * A contagem é por períodos completos de 24h desde a resposta, não por virada de calendário. Salvar novamente zera o contador.
  * **Sem histórico:** salvar substitui a resposta anterior. O que fica registrado é apenas a data da última vez.
* **Acesso:** cada pessoa vê e edita **apenas o próprio** ranking. O Gestor do time e o Admin veem, no Radar (seção 3.2.4), tanto o resultado agregado quanto o ranking individual de cada membro — decisão registrada naquela seção.
* **Modelagem:** tabela normalizada (uma linha por motivador) em vez de um JSON com a lista — o banco garante que ninguém repete motivador nem posição, e agregações futuras por time saem em SQL.

#### 3.2.4. Radar do Time — **entregue**

Visão agregada dos Moving Motivators de um time: o que move o grupo e quem está com a
dinâmica pendente. É a demanda que estava reservada ao Dashboard (seção 5), entregue como
tela própria no menu ("Radar").

* **Funcionalidades:**
  * Gráfico de radar com os 10 motivadores e a força de cada um no time, e os 3 primeiros em destaque.
  * **Mapa de calor individual:** matriz com uma linha por pessoa do time e uma coluna por motivador, mostrando a colocação (1 a 10) que cada um deu. A célula do nome traz **apenas o nome** — e o time, na visão consolidada. O papel saía sempre como "Colaborador", já que gestor não entra no Radar, e o aviso de revisão vencida já aparece no KPI e na faixa de atenção. As células são coloridas por faixa: **alta prioridade (1–3)**, **média (4–7)** e **baixa (8–10)**.
  * Cobertura: quantas pessoas do time responderam.
  * Lista de quem **nunca respondeu** e de quem está com a **revisão de 90 dias vencida**.
  * **Seletor de time**, quando o usuário tem acesso a mais de um. Lista apenas os times cujo Radar ele pode abrir: para o Gestor, os que ele **gere** (Principal ou Apoio) — não os que apenas integra como colaborador; para o Admin, todos. Um Gestor que participe de times apenas como colaborador recebe um estado vazio explicando que a visão pertence a quem gere o time.
  * **Visão consolidada — "Todos os meus times"**, primeira opção do seletor quando a pessoa gere mais de um time. Soma os times num único radar, e a matriz passa a mostrar o time de cada pessoa ao lado do nome.
  * **Guia dos motivadores:** um botão de ajuda ao lado dos filtros abre a lista dos dez, com a sigla usada nas colunas da matriz, o que cada um significa e como ler a escala (1º lugar = 10 pontos). É o mesmo texto do perfil — o guia descreve a prática, não a tela.
  * **Filtro por colaborador** (lista de seleção com os colaboradores do time). Ao escolher alguém, o mapa de calor mostra só a linha dessa pessoa e o gráfico **sobrepõe a série dela** ao polígono do time, tracejada — é a leitura que serve a uma conversa de 1:1: onde a pessoa acompanha o time e onde ela difere.
* **Regras de Negócio:**
  * A força de cada motivador usa **contagem de Borda**: o 1º lugar de cada pessoa vale 10 pontos e o 10º vale 1, e o resultado é a média entre quem respondeu. Somar posições diretamente inverteria o sentido (menor é melhor) e produziria um radar de cabeça para baixo.
  * Rankings incompletos são ignorados na média, para não distorcer os motivadores que contêm.
  * Uma resposta com revisão vencida **continua contando** no placar — ela é a informação mais recente que existe — mas a pessoa é marcada como pendente.
  * As colunas do mapa de calor seguem a **ordem de força no time**, não a ordem canônica: assim as células de alta prioridade se agrupam à esquerda e quem discorda do time salta aos olhos.
  * **Todos os colaboradores aparecem** no mapa, inclusive quem não respondeu — a linha fica tracejada, mostrando a lacuna sem precisar cruzar com outra lista.
  * O filtro por colaborador **não recalcula o que é do time**: polígono, destaques e cobertura seguem retratando o time inteiro, e a pessoa entra como uma segunda série sobre esse fundo. Recalcular sobre um único respondente transformaria o "radar do time" no radar da pessoa, que é justamente a comparação que se quer enxergar.
  * A série individual usa a **mesma escala** do time (colocação convertida em força: 1º = 10 pontos), então as duas linhas são diretamente comparáveis. Uma pessoa que ainda não respondeu não gera linha — o gráfico continua só com o time e a tela avisa.
  * Na visão consolidada, **cada pessoa conta uma vez**, mesmo participando de dois times somados. Contá-la duas vezes faria a resposta dela pesar o dobro da de um colega, e o placar deixaria de descrever o conjunto de pessoas para descrever o conjunto de vínculos.
  * Na visão consolidada, **quem gere qualquer um dos times somados fica de fora**, mesmo sendo colaborador em outro deles. É a mesma separação entre quem observa e quem é observado da visão por time; no conjunto ela precisa valer no conjunto, senão o gestor de um time reapareceria pela porta do outro.
  * A consolidação usa **apenas times ativos** e somente os que a pessoa gere — para o Admin, todos os ativos, como já vale na listagem de times.
  * **Quem exerce papel de gestão no time (Principal ou Apoio) fica fora do Radar** — da matriz, do gráfico, dos destaques e da contagem de cobertura. A visão existe para o gestor olhar a equipe; incluir a resposta dele misturaria quem observa com quem é observado, e num time pequeno a própria resposta chegaria a dominar a média. Um time formado apenas por gestores exibe estado vazio explicando isso, situação normal em time recém-criado.
* **Acesso e privacidade:** **Admin** e **Gestor**; o Colaborador não tem acesso (item ausente do menu, rota protegida e API recusando com 403). O Gestor só vê os times em que exerce papel de gestão — a mesma regra da administração de membros (RN2).
  > **Decisão de 2026-09-10:** a primeira versão desta tela era **somente agregada**, por serem os motivadores um dado pessoal sensível. A decisão de produto foi **expor o ranking individual** de cada membro para quem gere o time, por meio do mapa de calor. O acesso restrito a Gestor do próprio time e Admin é o que sustenta essa exposição, e o Colaborador segue sem ver o de ninguém — nem o dos colegas, nem o próprio time.

#### 3.2.5. Demais práticas Management 3.0 — **não especificadas**

Kudo Box, Niko-Niko e Personal Map seguem sem regra de negócio, modelo de dados ou tela.
Ver seção 5.

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
* **Fora de escopo:** recuperação de senha por e-mail ("esqueci minha senha"). O reset pelo Admin existe (seção 3.4.2) e cobre o caso de quem perde a senha, mas depende de haver um Admin disponível.

### 3.4. Gestão de Acessos pelo Admin

Exclusivo do **Admin**, na tela de Usuários: inativar/reativar acessos, alterar papel global
e redefinir a senha de outra pessoa.

#### 3.4.1. Alteração de papel global

* **Funcionalidade:** o Admin altera o papel de qualquer usuário entre Colaborador, Gestor e Admin.
* **Regras de Negócio:**
  * O Admin **não altera o próprio papel** — rebaixar-se poderia deixar o sistema sem nenhum Admin.
  * Não é possível rebaixar a Colaborador quem **exerce papel de gestão (Principal ou Apoio) em um time ativo**: papéis de gestão exigem Gestor ou Admin global, e o rebaixamento quebraria essa invariante. O time precisa ser ajustado antes. Quem gere apenas time **arquivado** pode ser rebaixado.
  * Promover quem gere time é sempre permitido (Admin também pode gerir time).
  * `AUDITOR` é recusado, por estar fora do escopo do MVP (seção 2).

#### 3.4.2. Redefinição de senha de terceiros

* **Funcionalidade:** o Admin define uma nova senha para outro usuário, **sem informar a antiga**.
* **Motivação:** não há recuperação de senha por e-mail. Sem este recurso, quem perde a senha só volta com alteração direta no banco.
* **Regras de Negócio:**
  * Mínimo de 8 caracteres, como no cadastro.
  * O Admin **não redefine a própria senha por aqui** — para isso existe a troca no perfil, que exige a senha atual. Assim uma sessão de Admin roubada não consegue trocar a senha do dono e trancá-lo fora.
  * A senha nunca é devolvida na resposta (204 sem corpo).
  * As sessões já abertas do usuário seguem válidas até expirar (mesma limitação de JWT descrita na seção 3.3).

#### 3.4.3. Inativação de acessos

Inativar **não exclui**: o vínculo com os times permanece, preservando o histórico de
participação que um `DELETE` destruiria.

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

#### 3.4.4. Login com SSO da Microsoft — **entregue**

Segunda porta de entrada, ao lado do login por e-mail e senha: **"Entrar com Microsoft"**
autentica pelo Microsoft Entra ID (antigo Azure AD) da organização.

A divisão de responsabilidade é a regra que organiza todo o resto: **a Microsoft responde
"quem é esta pessoa"; o Synergy responde "esta pessoa pode entrar"**.

* **Funcionalidades:**
  * Botão na tela de login, que abre o login da Microsoft e devolve a pessoa autenticada.
  * O "Manter sessão neste dispositivo" vale igual para os dois caminhos: a sessão criada é a mesma (o JWT do Synergy), só a forma de provar a identidade muda.
  * Sem cadastro correspondente, a tela informa **qual e-mail foi usado** e orienta a procurar o administrador.
* **Regras de Negócio:**
  * **Não há provisionamento automático.** O SSO nunca cria usuário: o Admin cadastra antes (seção 3.4 e 2). Consequência aceita: todo ingresso novo depende de uma ação do Admin antes do primeiro login — o que já era verdade para entrar em um time.
  * **O login por senha continua disponível para todos.** É a rede de segurança: se o Entra estiver indisponível ou o app registration for alterado, ninguém fica trancado fora — nem o Admin.
  * **Somente o tenant da organização.** Contas Microsoft de fora são recusadas na validação do token. Sem isso, "ter cadastro no Synergy" seria a única barreira, e não é nela que se confia.
  * **As guardas do login por senha valem igualmente:** usuário inativo não entra, e papel fora do escopo do MVP (`AUDITOR`) não recebe sessão. As duas checagens são a mesma função no código, para os caminhos não divergirem.
  * **O vínculo é pelo identificador da conta no Entra (`oid`), gravado no primeiro login**, não pelo e-mail. No primeiro acesso o e-mail é o que casa a conta; dali em diante vale o `oid`, que é imutável. Isso resolve dois casos: e-mail renomeado no Entra (a pessoa continua entrando) e endereço de quem saiu reaproveitado por outra pessoa (**recusado** — seguir adiante entregaria o histórico de alguém a um terceiro).
  * **O nome do Synergy não é sobrescrito** pelo nome vindo da Microsoft: o nome de exibição é editável pelo próprio usuário (seção 3.3), e sobrescrevê-lo a cada login desfaria essa edição sem avisar.
  * A mensagem de "sem cadastro" **pode citar o e-mail**, diferente do login por senha, cuja mensagem é genérica de propósito. Quem chega nesse ponto já provou ser dono da caixa postal, então não há existência de e-mail a proteger — e sem o endereço a pessoa não sabe o que pedir ao administrador.
* **Acesso e privacidade:** o aplicativo pede apenas `openid`, `profile` e `email` — não lê e-mail, arquivo, calendário nem contatos, e não acessa o Microsoft Graph.
* **Dependência externa:** exige um **app registration** no Entra da organização (tipo SPA, single tenant), de onde saem os dois identificadores públicos que a aplicação usa. Não há client secret neste fluxo. Ver README.

---

## 4. Estrutura de Dados Preliminar

> **Banco de dados:** PostgreSQL (acessado via GORM/pgx no backend, conforme `CLAUDE.md`).
>
> O Sorteio de Temas (3.2.1) e o Brackets (3.2.2) **não possuem modelo de dados**: as listas
> vivem no navegador durante a sessão e nada é gravado. O Moving Motivators (3.2.3), ao
> contrário, é dado pessoal e é persistido.


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

enum Motivator {
  CURIOSIDADE
  LIBERDADE
  PROPOSITO
  MAESTRIA
  RELACOES
  HONRA
  ACEITACAO
  ORDEM
  PODER
  STATUS
}

// Moving Motivators (seção 3.2.3): uma linha por motivador, com a posição
// escolhida. O par (userId, motivator) e o par (userId, rankPosition) são
// únicos, então o banco impede motivador repetido e duas prioridades na mesma
// posição.
model UserMotivator {
  userId       String    @map("user_id")
  motivator    Motivator
  rankPosition Int       @map("rank_position") // 1 a 10
  updatedAt    DateTime  @default(now()) @map("updated_at")
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, motivator])
  @@unique([userId, rankPosition])
}

model User {
  id        String     @id @default(uuid())
  name      String
  email     String     @unique
  role      Role       @default(COLABORADOR)
  status    UserStatus @default(ACTIVE)
  profile   Profile?
  createdAt DateTime   @default(now())
  // Conta do Entra ID vinculada no primeiro login por SSO (seção 3.4.4). Nulo
  // enquanto a pessoa nunca entrou pela Microsoft; único, para duas contas do
  // Synergy não apontarem para a mesma pessoa no Entra.
  microsoftOid String? @unique @map("microsoft_oid")
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
* **Dashboard / Behavioral Insights:** o `DESIGN-SYSTEM.md` já especifica os componentes visuais (KPI Cards, grade de insights comportamentais), mas nenhuma regra de negócio, fonte de dado ou tela real entra neste MVP — apenas o componente de KPI Card genérico é construído, sem dado de produto por trás. **Já há uma demanda esperando por ele:** a visão do Gestor sobre os Moving Motivators do time, incluindo quem está com a revisão de 90 dias vencida.
* **Módulo de Metas (Goal):** avaliação e acompanhamento de metas citados na visão geral e na matriz de RBAC, mas sem modelo de dados nem épico detalhado nesta versão.
* **Gamificação (regras de XP e nível):** os campos `xp` e `level` existem no `Profile` desde a primeira versão, mas **nunca são alterados** — não há regra que defina o que gera XP, quanto vale cada evento, nem a curva de nível. Por isso não são exibidos na interface (seção 3.3). Especificar isso depende de Metas e Dinâmicas, já que os candidatos naturais a gerar XP (meta concluída, participação em dinâmica, kudo recebido) vivem nesses épicos.
* **Práticas Management 3.0 restantes:** Kudo Box, Niko-Niko e Personal Map continuam sem especificação. O Moving Motivators (seção 3.2.3) foi entregue.
* ~~Visibilidade do Moving Motivators pelo Gestor~~ → **entregue** como Radar do Time (seção 3.2.4), em tela própria em vez de esperar o Dashboard.
* **Histórico do Moving Motivators — descartado por ora:** salvar substitui a resposta anterior; guarda-se apenas a data da última. Se a evolução ao longo do tempo passar a interessar (útil em retrospectiva), vira um épico próprio.
* **Persistência do Sorteio de Temas:** a lista de temas não é salva. Ficam em aberto, caso o módulo prove aderência: temas cadastrados por time, histórico de sorteios (para não repetir tema toda semana) e restrição de quem pode sortear.
* **Recuperação de senha pelo próprio usuário:** não há fluxo de "esqueci minha senha" por e-mail. O reset pelo Admin (seção 3.4.2) resolve o caso comum, mas se o único Admin perder a senha, ainda é preciso alterar direto no banco.
* **Troca de e-mail:** nem o próprio usuário nem o Admin trocam e-mail pela aplicação — é a identidade de login e exigiria fluxo de confirmação. Para quem já entrou por SSO isso é menos crítico: o vínculo passa a ser o `oid` do Entra, e um endereço renomeado lá não quebra o acesso (seção 3.4.4).
* **SSO — o que ficou de fora:** papel e time vindos de grupos do Entra (hoje quem define os dois é o Admin, dentro do Synergy); provisionamento automático de usuários (SCIM); encerrar também a sessão da Microsoft ao sair do Synergy; e cadastro de usuário "somente SSO", sem senha — hoje todo cadastro nasce com senha, mesmo que a pessoa só use o botão da Microsoft.
* **Revogação de sessão:** trocar a senha não invalida tokens já emitidos. Exigiria lista de bloqueio ou versionamento de credencial no JWT.