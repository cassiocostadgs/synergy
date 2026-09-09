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

O sistema utiliza um layout fixo com duas barras de navegação principais:

### 3.1. SideNavBar (Barra Lateral Esquerda)
- **Largura:** `w-64` (fixa à esquerda, `h-screen`).
- **Fundo:** `bg-surface-container-low` com borda divisória sutil.
- **Cabeçalho da Sidebar:** apenas o logotipo "Synergy", sem subtítulo.
- **Abas de Navegação:**
  - Ícones do Google Material Icons / Material Symbols.
  - Estado ativo: Fundo translúcido ou borda lateral destacada com a cor primária (`#ff2d78` ou `#00ffff`).
- **Sem rodapé.** A sidebar contém somente a navegação por área do produto. O que é do próprio usuário (perfil e sair) fica no menu do canto superior direito.

### 3.2. TopNavBar (Barra Superior)
- **Altura:** `h-16` / `h-20`, sticky (`top-0 z-50`).
- **Layout:** Flexbox com alinhamento `justify-between`, padding lateral generoso.
- **Elementos:**
  - **Sem links de navegação.** A navegação vive exclusivamente na SideNavBar (e na BottomNavBar no mobile, onde a lateral fica oculta) — o cabeçalho não duplica o menu.
  - **Menu do usuário no canto superior direito:** nome, papel, nível e avatar formam um botão que abre o menu com *Meu perfil* e *Sair*. Fecha ao clicar fora ou com `Esc`.

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

### 4.3. Tabelas de Gestão (RBAC / Usuários / Teams)
- **Cabeçalho de Tabela:** Texto em maiúsculo, espaçamento organizado.
- **Linhas:** Efeito hover sutil (`hover:bg-surface-container-high`), avatares com iniciais coloridas (ex: crachás circulares rosa/ciano), badges de status (`Active`, `Admin`, `User`) e botões de ação compactos (Visualizar, Editar, Excluir).

---

## 5. Diretrizes para a IA na Geração de Código HTML/Tailwind
1. **Sempre utilize Tailwind CSS** com classes utilitárias modernas e variáveis de cor consistentes com o tema escuro.
2. **Efeitos de Glow:** Adicione classes de sombra customizadas ou `drop-shadow-[0_0_8px_rgba(...)]` para simular luzes neon.
3. **Responsividade:** Garanta que o layout desktop utilize SideNavBar + TopNavBar e o layout mobile adapte-se para BottomNavBar flutuante.
4. **Fidelidade ao Conteúdo:** Mantenha os textos em português conforme especificado nas PRDs do projeto Synergy.
