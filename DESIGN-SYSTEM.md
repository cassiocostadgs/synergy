 # Synergy — Guia de Implementação e Layout (IA Instructions)

Este documento descreve detalhadamente a arquitetura visual, o sistema de design, os componentes e a estrutura de layout do projeto **Synergy** (Tema: **Neon Tokyo** / Cyberpunk). Utilize estas diretrizes para construir ou replicar telas consistentes com este ecossistema.

---

## 1. Visão Geral e North Star ("Electric Nightscape")
- **Conceito:** Cyberpunk-inspired, retro-futurista, imersivo e de alta energia.
- **Modo de Cor:** Dark Mode obrigatório (`bg-surface` escuro profundo com acentos luminosos).
Dupla tipográfica no estilo **HUD de video game** — uma display marcante para a voz de
marca e uma techno legível para o conteúdo:

- **Texto da interface — `Chakra Petch`** (token `--font-sans`, padrão do `body`): techno com cantos chanfrados, bem cyberpunk, com caixa mista real e legível nos rótulos de 13px das tabelas. Cobre navegação, rótulos, botões, tabelas e formulários.
- **Display — `Orbitron`** (token `--font-display`, classe `font-display`): a sci-fi geométrica clássica de HUD. Larga demais para texto corrido, então fica **restrita a trechos curtos**: logotipo, títulos de página, nome de time nos cards e valores de KPI.
- **Ajustes de legibilidade:** o `body` usa `font-size: 16px` e `letter-spacing: 0.01em`; a escala tipográfica (`--text-*`) está um passo acima do padrão do Tailwind.
- **Sem fonte de apoio:** como a Chakra Petch tem caixa mista real, e-mails e campos de formulário não precisam mais de uma terceira família (o antigo `--font-body` com `Sora` foi removido).
- **Histórico de escolha:** `Sora` → `Bebas Neue` → `Cinzel` → `Grenze Gotisch` → **`Orbitron` + `Chakra Petch`**. As quatro primeiras eram fonte única; a lição foi que display única não sustenta tabela e formulário. Para trocar, mexa no `<link>` do Google Fonts em `index.html` e nos tokens `--font-sans` / `--font-display` em `src/index.css`.

---

## 2. Paleta de Cores e Tokens (Design System: Neon Tokyo)
- **Primary / Accent Neon Pink:** `#ff2d78` (Usado em CTAs principais, barras de progresso de metas, bordas ativas e destaques primários).
- **Secondary / Cyan Glow:** `#00ffff` / `#00fbfb` (Usado em avatares, status seguros, indicadores de sentimento e subtítulos).
- **Surface / Background:** `#0d1515` a `#071010` (Fundos escuros texturizados com malhas/grid futuristas).
- **Surface Containers (Cards):** `#151d1d` com efeitos de *glassmorphism* (fundo translúcido + bordas sutis com brilho neon).

---

## 3. Arquitetura do App Shell (Layout Base)

O sistema utiliza um layout fixo com três barras: **SideNavBar** e **TopNavBar** no desktop,
e a **BottomNavBar** flutuante quando a lateral fica oculta (abaixo de `lg`).

### 3.1. SideNavBar (Barra Lateral Esquerda)
- **Largura:** `w-52` (fixa à esquerda, altura total). Ajustada ao conteúdo — `w-64` deixava espaço vazio à direita dos rótulos.
- **Fundo:** `bg-surface-container-low/80` com `backdrop-blur`, separado do conteúdo apenas pela borda direita.
- **Sem divisórias horizontais internas:** o painel é um bloco único; nada de linhas cortando entre logotipo, navegação e rodapé.
- **Cabeçalho da Sidebar:** apenas o logotipo "Synergy" (tamanho `sm`, que é o que cabe em `w-52`), sem subtítulo.
- **Abas de Navegação:**
  - Ícones do Google Material Icons / Material Symbols.
  - Estado ativo: Fundo translúcido ou borda lateral destacada com a cor primária (`#ff2d78` ou `#00ffff`).
  - Itens: *Times*, *Usuários*, *Radar*, *Sorteio* e *Brackets*. **Usuários** e **Radar** só aparecem para Admin e Gestor — o item some do menu além de a rota e a API recusarem (PRD seções 2 e 3.2.4).
  - **Perfil não é item de navegação:** é alcançado pelo bloco do usuário no canto superior direito.
- **Rodapé com "Sair"**, no canto inferior esquerdo, separado da navegação por área do produto. Encerrar sessão não é um destino como os outros, e o canto inferior é onde não se clica por engano ao navegar.

### 3.2. TopNavBar (Barra Superior)
- **Altura:** `h-16`, sticky (`top-0 z-50`), com fundo translúcido e `backdrop-blur`.
- **Layout:** Flexbox, padding lateral generoso (`px-4 sm:px-8`).
- **Elementos:**
  - **Sem links de navegação.** A navegação vive exclusivamente na SideNavBar (e na BottomNavBar no mobile, onde a lateral fica oculta) — o cabeçalho não duplica o menu.
  - **Logotipo apenas no mobile** (`lg:hidden`): no desktop ele já está no topo da lateral.
  - **Bloco do usuário no canto superior direito:** nome, papel e avatar formam um **link direto para o perfil** — não um menu suspenso. Com "Sair" no rodapé da lateral, sobrou um único destino, e menu de um item só é atrito.
  - **Sem "Nível N"** ao lado do nome: não há regra que altere o nível, então o valor seria sempre 1 (PRD seção 5).

### 3.3. BottomNavBar (Mobile)
- **Formato:** barra flutuante (`fixed inset-x-4 bottom-4`), cantos `rounded-2xl`, fundo translúcido com `backdrop-blur`. Substitui a SideNavBar abaixo de `lg`.
- **Conteúdo:** os mesmos itens da lateral, com a mesma filtragem por papel, e **"Sair" como primeiro item, à esquerda** — espelha a posição que ele ocupa no rodapé da lateral no desktop.
- **Consequência de layout:** o `main` reserva `pb-28` no mobile para o conteúdo não ficar embaixo da barra (`lg:pb-10` quando ela não existe).

---

## 4. Componentes Principais e Padrões de UI

### 4.1. Cartões de Métricas (KPI Cards)
- **Estilo:** Vidro fosco (`bg-surface-container` / `bg-surface-dim`), cantos arredondados, bordas com leve gradiente ou box-shadow com glow neon (ex: `shadow-[0_0_12px_rgba(255,45,120,0.1)]`).
- **Estrutura interna:**
  - Rótulo superior em caixa alta e fonte menor (ex: `GOAL ATTAINMENT`).
  - Valor principal em destaque (ex: `85%` ou `4,8 / 5.0`) com fontes grandes e negrito.
  - Indicadores de tendência (ex: `+2.4%` com seta para cima em verde/ciano) ou barras de progresso neon preenchidas.

### 4.2. Grade de Behavioral Insights (Nós de Rede)
- **Grid:** 4 colunas em desktop, responsivo para mobile.
- **Cards de Insights:** Intensidade, Justiça, Excelência, Cuidado, Camaraderie, Evolução, Silos, Superação.
- **Estilização:** Ícones temáticos, fundo escuro de container e bordas finas com glow ao passar o mouse (`hover:border-primary`).

### 4.3. Roleta de Sorteio (Dinâmicas)

- **Setores:** paleta neon própria de 8 cores, cada uma com a cor de texto que preserva contraste sobre ela. As cores ciclam quando há mais setores que cores.
- **Rótulos:** dispostos radialmente, invertidos 180° na metade esquerda da roda para não ficarem de cabeça para baixo; tamanho de fonte proporcional à quantidade de setores, e omitidos acima de 16 setores.
- **Ponteiro:** fixo no topo, na cor primária — é ele que define o setor vencedor.
- **Animação:** 5 voltas com `cubic-bezier(0.16, 1, 0.3, 1)` e glow neon no conjunto. Respeita `prefers-reduced-motion`, entregando o resultado sem giro.
- **Tamanho:** a roda ocupa a coluna elástica do layout, e a lista de temas fica numa faixa fixa — `18rem`, subindo a `22rem` a partir de `xl`. Em geral: **quando uma tela tem um elemento gráfico e um formulário, a largura extra vai para o gráfico** — o contrário produz campo de texto gigante ao lado de um desenho pequeno.
- **Ajuste à altura da janela (sem rolagem):** como a roda é quadrada, o teto de **largura** também controla a altura — `min(28rem, 100svh - 26rem)`, onde `28rem` evita o disco de tela cheia em monitor largo e a parte em `svh` desconta o que o app gasta em volta (cabeçalho, respiros do `main`, título da página, botão e área do resultado). O campo de temas tem teto equivalente. **Padrão da casa:** dar o teto em `svh` a cada cartão, em vez de altura fixa na linha do grid — altura fixa estica os cartões e cria espaço morto quando o conteúdo para de crescer. Abaixo de ~620px de altura útil a rolagem volta, por um piso de `12rem`: roda ilegível é pior que rolagem.
- **Regra de implementação:** o vencedor é sorteado **antes** da animação e a roda gira até ele. Nunca derive o vencedor do ângulo final.

### 4.4. Telas que cabem na janela (sem rolagem)

Padrão usado no Radar, aplicável a qualquer tela densa.

- **Coluna de altura de viewport:** a tela é uma coluna flex com `h-[calc(100svh - Xrem)]`, onde `X` é só o que fica **fora** dela. Esse valor **muda com o breakpoint**: em `md` o `main` reserva 6rem embaixo para a BottomNavBar flutuante; em `lg` a lateral toma o lugar dela e a reserva cai para 2.5rem. Um valor único erra em um dos dois.
- **O que tem altura variável não entra na conta.** Título, KPIs e faixas de aviso são itens da coluna e descontam a altura real deles — subtrair um valor fixo exigiria adivinhar se o cabeçalho quebrou em duas linhas ou se a faixa existe.
- **`min-h-fit` como válvula:** quando nem no tamanho mínimo o conteúdo couber, a coluna cresce e a página rola. Rolar é aceitável; conteúdo vazando para fora do cartão, não.
- **`min-h-0` só em quem rola por dentro.** É ele que autoriza um item flex a encolher abaixo do próprio conteúdo. No cartão que tem rolagem interna (uma tabela), é o que faz a rolagem funcionar; em qualquer outro, é o que faz o conteúdo vazar.
- **Gráfico se ajusta ao container, não ao viewport:** `flex-1` com piso de altura, dentro de um cartão de altura conhecida. Sendo SVG com razão intrínseca, ele encolhe inteiro e continua centrado. Conta por `svh` em elemento aninhado é frágil — ela ignora tudo que está entre o viewport e ele.
- **Abaixo de 760px de altura, o enfeite sai:** cartões de KPI viram uma linha de texto com os mesmos números, notas explicativas e destaques redundantes somem, e os respiros encolhem. Num notebook 1280x800 com escala de 150% a viewport tem ~440px — três cartões de KPI custariam um quarto dela.
- **`min-h-0` decide quem cede espaço.** Um elemento com proporção intrínseca (SVG, imagem, vídeo) reivindica como altura mínima a que a proporção pede — sem `min-h-0` no ancestral flex, isso trava a cadeia inteira e a página rola. O piso de tamanho deve morar num wrapper com `min-height` explícito, não na impossibilidade de encolher.
- **Degraus de piso usam faixas que não se sobrepõem** (`min-height` + `max-height` no mesmo media query). Com dois media queries casando ao mesmo tempo, quem vence depende da ordem que o Tailwind gera — e o degrau menor nunca aplica.
- **Subtítulo só some se for explicação.** `PageHeader` tem `subtitleOptional` justamente porque em algumas telas ele carrega **estado** (em Brackets, "Disputa encerrada"). Esconder por altura o que não aparece em outro lugar é perder informação, não ganhar espaço.

### 4.5. Tela de Login

- **Cartão único** centralado (`max-w-sm`), com o logotipo na vertical e `shadow-glow-primary`.
- **Ordem:** formulário de e-mail e senha primeiro, divisória com "ou", e então o botão do SSO. O caminho por senha vem antes por ser o que funciona em qualquer ambiente — o SSO depende de configuração.
- **Botão "Entrar com Microsoft":** variante `ghost` (neutra), largura total, com a **marca da Microsoft em SVG inline** — os quatro quadrados nas cores oficiais (`#f25022`, `#7fba00`, `#00a4ef`, `#ffb900`).
  > **Exceção deliberada à diretriz de ícones:** este é o único lugar que não usa Material Symbols. As diretrizes de marca da Microsoft pedem o logotipo no botão de entrada — é o que faz a pessoa reconhecer para onde vai — e não existe logotipo de marca no Material Symbols. Não troque por um ícone genérico.
- **Erros separados:** a falha do login por senha aparece dentro do formulário; a do SSO, abaixo do botão do SSO. Cada mensagem fica junto do que falhou.
- **O botão do SSO só existe se estiver configurado** (`VITE_MS_TENANT_ID` e `VITE_MS_CLIENT_ID`): sem isso, a tela é apenas o formulário.

### 4.6. Tabelas de Gestão (RBAC / Usuários / Teams)
- **Cabeçalho de Tabela:** Texto em maiúsculo, espaçamento organizado.
- **Linhas:** Efeito hover sutil (`hover:bg-surface-container-high`), avatares com iniciais coloridas (ex: crachás circulares rosa/ciano), badges de status (`Active`, `Admin`, `User`) e botões de ação compactos (Visualizar, Editar, Excluir).

---

## 5. Diretrizes para a IA na Geração de Código HTML/Tailwind
1. **Sempre utilize Tailwind CSS** com classes utilitárias modernas e variáveis de cor consistentes com o tema escuro.
2. **Efeitos de Glow:** Adicione classes de sombra customizadas ou `drop-shadow-[0_0_8px_rgba(...)]` para simular luzes neon.
3. **Responsividade:** Garanta que o layout desktop utilize SideNavBar + TopNavBar e o layout mobile adapte-se para BottomNavBar flutuante.
4. **Fidelidade ao Conteúdo:** Mantenha os textos em português conforme especificado nas PRDs do projeto Synergy.
