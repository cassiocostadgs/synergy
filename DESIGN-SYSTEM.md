 # Synergy — Guia de Implementação e Layout (IA Instructions)

Este documento descreve detalhadamente a arquitetura visual, o sistema de design, os componentes e a estrutura de layout do projeto **Synergy** (Tema: **Neon Tokyo** / Cyberpunk). Utilize estas diretrizes para construir ou replicar telas consistentes com este ecossistema.

---

## 1. Visão Geral e North Star ("Electric Nightscape")
- **Conceito:** Cyberpunk-inspired, retro-futurista, imersivo e de alta energia.
- **Modo de Cor:** Dark Mode obrigatório (`bg-surface` escuro profundo com acentos luminosos).
- **Tipografia Principal:** `Sora` (pesos variando de regular a bold, com títulos marcantes e tracking ajustado).

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
- **Cabeçalho da Sidebar:** Logotipo "Synergy" com subtítulo de ambiente (ex: *Remote Intelligence* ou *Operations*).
- **Abas de Navegação:**
  - Ícones do Google Material Icons / Material Symbols.
  - Estado ativo: Fundo translúcido ou borda lateral destacada com a cor primária (`#ff2d78` ou `#00ffff`).
- **Rodapé da Sidebar:** Botões de Ação rápida (ex: "New Report", "Spawn User", "Help", "Logout").

### 3.2. TopNavBar (Barra Superior)
- **Altura:** `h-16` / `h-20`, sticky (`top-0 z-50`).
- **Layout:** Flexbox com alinhamento `justify-between`, padding lateral generoso.
- **Elementos:** 
  - Links centrais de navegação (Dashboard, Teams, Dynamics, Settings).
  - Ícones de ações à direita (Notificações, Configurações, Avatar do Usuário).

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
