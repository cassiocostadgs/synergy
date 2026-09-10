# ✅ tasks.md — Synergy MVP

> Gerado a partir de `PRD.md`, `CLAUDE.md` e `DESIGN-SYSTEM.md` (2026-09-08).
> Escopo inicial: RBAC + Épico 3.1 (Gestão de Times e Membros) + App Shell. As fases 4.1 a
> 4.5 foram acrescentadas depois, conforme cada demanda apareceu — Dinâmicas, Autogestão,
> Gestão de Acessos e SSO da Microsoft. O escopo atual, consolidado, está no `README.md`.
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

### Brackets — concluído
- [x] Rota `/brackets` e item "Brackets" no menu lateral
- [x] Lógica pura em `features/brackets/bracket.ts`, sem React nem dependências — testável isoladamente
- [x] **Byes:** chave cresce até a próxima potência de 2 e a diferença vira passagem direta (5 opções → chave de 8 com 3 byes); a tela avisa quantos byes haverá antes de criar
- [x] Chave **derivada** das escolhas, não mutada — trocar um vencedor anterior invalida automaticamente as escolhas seguintes que dependiam dele
- [x] Tema (60 caracteres), de 2 a 16 opções, até 40 caracteres cada, sem repetidas
- [x] Embaralhamento opcional da primeira rodada (ligado por padrão), que é também o sorteio de quem recebe bye
- [x] Rodadas nomeadas (Oitavas, Quartas, Semifinal, Final); campeão destacado e anunciado por `aria-live`
- [x] Ações "Recomeçar" (mantém a chave, limpa as escolhas) e "Nova chave"
- [x] Verificado por script independente sobre o módulo real: 11 tamanhos de chave (2 a 16), torneio completo para 8 tamanhos com a propriedade **nº de opções − 1 cliques**, o caso de invalidação em cascata e 8 casos de borda da validação

### Pendências, caso o módulo prove aderência
- [ ] Persistência da chave (hoje recarregar a página perde o progresso — pior que no Sorteio, porque o Brackets leva mais tempo para concluir)
- [ ] Testes automatizados da lógica de chaveamento (hoje verificados por script pontual, fora de suíte)

### Moving Motivators — concluído (PRD seção 3.2.3)

Primeira prática nomeada do Management 3.0. **Diferente dos dois jogos anteriores: é dado
pessoal e é persistido** — perder ao recarregar não faria sentido num perfil.

- [x] Migration `0003_motivators`: enum `motivator` com os 10 valores e tabela `user_motivators`
- [x] Modelo **normalizado** (uma linha por motivador) em vez de JSON — o banco garante as invariantes e habilita agregação por time em SQL
- [x] `domain`: `Motivator`, lista canônica, `MotivatorRanking`, `MotivatorRepository`
- [x] `repository`: `Replace` apaga e regrava em transação única (um UPDATE posição a posição violaria a unicidade no meio do caminho)
- [x] `usecase`: exige **permutação completa dos 10**; recusa lista parcial, repetida ou desconhecida
- [x] `GET /api/v1/me/motivators` e `PUT /api/v1/me/motivators` (PUT porque substitui, não mescla)
- [x] Frontend: bloco no perfil com arraste **e** setas — só o arraste deixaria a dinâmica inacessível por teclado e falharia em toque
- [x] Top 3 destacado, data do último preenchimento, botão Desfazer, aviso para quem nunca respondeu
- [x] Cliente HTTP e CORS passaram a aceitar `PUT`
- [x] **9 testes unitários** novos (total do backend: **70**)
- [x] Verificado de ponta a ponta: validações (400 para parcial/vazia/repetida/inválida), persistência, regravação sem acumular, isolamento entre usuários, e as restrições do banco recusando posição duplicada e fora de 1..10

### Revisão a cada 90 dias — concluído
- [x] `PeriodoRevisaoDias = 90` e os cálculos no **domínio**, não no frontend — a regra tem uma fonte da verdade só
- [x] `DiasDesdeResposta`, `PrecisaRevisar` e `DiasParaRevisar`, com corte **inclusivo** no 90º dia
- [x] Contagem por períodos completos de 24h (não por virada de calendário) e proteção contra relógio para trás
- [x] API expõe `daysSinceAnswer`, `daysUntilReview`, `reviewPeriodDays` e `needsReview`
- [x] Tela mostra "respondido há N dias · próxima revisão em M dias"; ao vencer, faixa de alerta com os dias de atraso
- [x] Salvar zera o contador
- [x] **5 testes unitários** no pacote `domain`, um deles cobrindo 7 faixas de tempo (total do backend: **75**, em 2 pacotes)
- [x] Verificado contra o banco com respostas retrodatadas: 0, 45, 89, 90 e 120 dias

### Decisões registradas (2026-09-10)
- **Gestor verá os motivadores do time, pelo Dashboard** — não pela tela de perfil. Entra junto com o Dashboard, que segue não especificado (PRD seção 5).
- **Sem histórico de respostas.** Guarda-se apenas a data da última. Se a evolução no tempo passar a interessar, vira épico próprio.

### Radar do Time — concluído (PRD seção 3.2.4)

- [x] `GET /api/v1/teams/{teamId}/motivators` — placar agregado do time
- [x] `domain.AgregarMotivators`: contagem de Borda (1º = 10 pontos, 10º = 1), lógica pura e testável
- [x] `repository.FindByUsers`: uma consulta só para todos os membros, em vez de uma por pessoa
- [x] Reaproveita `requireTeamManager` do `TeamUseCase` em vez de duplicar a regra de acesso
- [x] ~~Somente agregado~~ → **revertido em 2026-09-10 por decisão de produto:** a resposta passou a incluir o ranking individual de cada membro, para alimentar o **mapa de calor**. O controle de acesso (Admin e Gestor do próprio time) é o que sustenta a exposição
- [x] Mapa de calor individual: matriz pessoa × motivador, células coloridas por faixa (1–3 alta, 4–7 média, 8–10 baixa), substituindo a tabela de placar
- [x] Colunas ordenadas pela força no time, para as células de alta prioridade se agruparem à esquerda
- [x] Todos os colaboradores aparecem, inclusive quem não respondeu (linha tracejada) e quem tem revisão vencida (ícone ao lado do nome)
- [x] **Gestores ficam fora do Radar** (decisão de 2026-09-10): fora da matriz, do gráfico, dos destaques e da cobertura — os números refletem exatamente o que está na tela. Estado vazio próprio para time só com gestores
- [x] Gráfico ocupa metade do espaço (duas colunas iguais)
- [x] **Filtro por colaborador** em lista de seleção (`Select`) com os colaboradores do time, validado contra o time corrente — trocar de time descarta uma seleção que não existe mais
- [x] **Gráfico reage ao filtro sobrepondo** a série da pessoa (polígono tracejado em ciano) ao do time, que fica atenuado; legenda aparece só quando há duas séries. Sem chamada nova ao backend: a conversão de colocação em força (`11 - posição`) é a mesma contagem de Borda, e com um respondente não há média a fazer
- [x] Filtro não recalcula o que é do time (polígono, destaques, cobertura) — a comparação pessoa × time é o objetivo da tela. Pessoa sem resposta não gera linha e a tela avisa
- [x] Verificado contra os dados reais do Squad Neon: a média das forças individuais calculadas no cliente coincide com o score agregado do backend em todos os 10 motivadores (diferença 0,000000)
- [x] **Corrigido: seletor de time listava times sem acesso.** `GET /teams` devolve todos os times que a pessoa integra, então um Gestor que fosse simples colaborador em outro time via aquele time no seletor e recebia 403 ao escolhê-lo. A listagem passou a informar `myRole` por time, e o seletor filtra pelos que a pessoa gere (Admin vê todos). Estado vazio próprio para Gestor que não gere nenhum time
- [x] Resposta com revisão vencida continua contando no placar, mas a pessoa entra em pendentes
- [x] Rota `/radar` e item "Radar" no menu, restritos a Admin e Gestor
- [x] Frontend: gráfico de radar em SVG puro (sem biblioteca), placar com barras, KPIs de cobertura e lista de pendentes
- [x] **11 testes unitários** novos (total do backend: **100**, em 2 pacotes)
- [x] Verificado por HTTP: Colaborador **403**, Admin e Gestor do time **200**, e a soma dos scores igual a 55 — propriedade da contagem de Borda que valida a fórmula

### Dados de demonstração
Semeadas respostas aleatórias para os 4 membros do Squad Neon, com datas distribuídas de
propósito (5, 40, 75 e 105 dias) para a tela exibir tanto "em dia" quanto revisão vencida.

### Pendências
- [x] ~~Decidir se o Gestor pode ver o ranking individual~~ → **decidido: pode**, via mapa de calor (PRD seção 3.2.4)
- [x] Layout calibrado com o exemplo enviado (mapa de calor) e compactado para caber sem rolagem em 1080p
- [x] ~~Avisar o colaborador que o gestor vê a resposta dele~~ → **decisão de 2026-09-10: não é necessário.** O acesso do gestor ao ranking individual é intencional e não requer aviso na tela do colaborador. Reabrir se a equipe de gente/RH pedir transparência explícita.

### Demais práticas Management 3.0 — fora de escopo
- [ ] Kudo Box, Niko-Niko e Personal Map seguem sem regra de negócio, modelo de dados ou tela (PRD seção 5)

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
- [ ] Recuperação de senha por e-mail ("esqueci minha senha") — o reset pelo Admin cobre o caso comum, mas se o único Admin perder a senha ainda depende do banco
- [ ] Revogação de sessão ao trocar ou redefinir a senha (hoje os tokens emitidos seguem válidos até expirar)
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

## Fase 4.4 — Papel e senha de terceiros pelo Admin (PRD seção 3.4.1 e 3.4.2)

Motivação concreta: em três ocasiões a falta desses recursos obrigou a alterar o banco
direto para tarefas triviais de administração.

- [x] `PATCH /api/v1/users/{userId}/role` — Admin altera o papel global
- [x] `POST /api/v1/users/{userId}/reset-password` — Admin define nova senha sem informar a antiga
- [x] `domain`: `UpdateRole` e `ManagesActiveTeam` (papel de gestão em time ativo, Principal **ou** Apoio)
- [x] Guardas de papel: Admin não altera o próprio; não rebaixa a Colaborador quem gere time ativo (time arquivado pode); `AUDITOR` recusado
- [x] Guardas de senha: mínimo de 8 caracteres; **Admin não redefine a própria por aqui** — usa o perfil, que exige a senha atual, para que sessão roubada não tranque o dono fora
- [x] Resposta 204 sem corpo no reset: a senha nunca é ecoada de volta
- [x] Frontend: botões "Papel" e "Senha" por linha na tela de Usuários, com diálogos e confirmação de senha
- [x] **13 testes unitários** novos (total do backend: **88**)
- [x] Verificado por HTTP: as 6 guardas retornando 409/400/403, promoção e rebaixamento reais, e o fluxo completo de reset (204 → nova senha entra, antiga é recusada)

---

## Fase 4.5 — Login com SSO da Microsoft (PRD seção 3.4.4)

Decisões tomadas antes de codar: **MSAL no front** (em vez de a dança do OAuth acontecer no
backend), **login por senha mantido para todos** como rede de segurança, e **vínculo pelo
`oid` do Entra** gravado no primeiro login.

- [x] `POST /api/v1/auth/microsoft` — rota pública, recebe o ID token e devolve a **mesma**
      resposta do login por senha
- [x] `internal/auth/microsoft.go`: validação do ID token com JWKS do tenant — assinatura
      (só RS256), `iss`, `aud` igual ao client ID, `tid` igual ao tenant, `exp` obrigatório
      e folga de 1 min para desvio de relógio
- [x] Cache de chaves públicas com recarga na rotação e **intervalo mínimo de 5 min**, para
      token com `kid` inventado não virar enxurrada de requisições à Microsoft
- [x] JWKS indisponível devolve **500, não 401**: "credencial inválida" quando o problema é
      nosso manda o usuário procurar defeito no lugar errado
- [x] `usecase.permitirSessao` compartilhada pelos dois caminhos de login (inativo e papel
      fora do MVP) — com as checagens copiadas, a próxima regra entraria só em um deles
- [x] Vínculo por `oid`: primeiro login casa por e-mail e grava; dali em diante o `oid` tem
      precedência (e-mail renomeado no Entra continua entrando)
- [x] E-mail reaproveitado por outra conta do Entra é **recusado** — passar entregaria o
      histórico de uma pessoa a outra
- [x] Código de erro próprio `SSO_SEM_CADASTRO` (403) com o **e-mail usado** na mensagem;
      diferente do login por senha, aqui citar o endereço não vaza nada, porque quem chegou
      lá já provou ser dono da caixa postal
- [x] `microsoft_oid` (migration 0004) com `UNIQUE` — no PostgreSQL vários NULL não
      conflitam, então não precisou de índice parcial
- [x] Nome do Synergy **não** é sobrescrito pelo do token: o usuário edita o próprio nome
- [x] `MS_TENANT_ID`/`MS_CLIENT_ID` validadas na subida — as duas juntas, e em GUID (nome de
      domínio no lugar do Directory ID falharia só em produção, como "token inválido")
- [x] Frontend: botão com a marca da Microsoft, MSAL inicializado ao montar a tela (para o
      navegador não bloquear o popup), cache do MSAL limpo após cada tentativa, cancelamento
      tratado como desistência e não como erro
- [x] MSAL carregado por `import()` dinâmico: bundle principal segue em ~308 kB e os ~284 kB
      da biblioteca só baixam na tela de login
- [x] **28 testes unitários** novos (16 do validador, com chave RSA real e JWKS local; 12 do
      caso de uso) — total do backend: **132**
- [x] Tokens recusados nos testes: assinado com outra chave, algoritmo trocado para HMAC,
      audience de outro app, emissor de outro tenant, `tid` divergente, expirado, sem `exp`,
      sem `oid` e sem e-mail utilizável

### Pendências

- [ ] **Teste ponta a ponta com a Microsoft** — depende do app registration no Entra da DB1.
      Até lá, o SSO fica desligado por ausência das variáveis e a tela de login não muda
- [ ] Cadastro "somente SSO" (usuário sem senha utilizável), se o SSO virar o caminho padrão
- [ ] Papel e time a partir de grupos do Entra — hoje quem define é o Admin, dentro do Synergy

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
