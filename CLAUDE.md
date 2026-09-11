# 🤖 AI Guidelines & Project Conventions — Synergy

## 1. Visão Geral e Monorepo
Este é um repositório monorepo do projeto **Synergy**. O backend em Go e o frontend em React operam de forma isolada dentro de suas respectivas pastas, seguindo arquiteturas em camadas bem definidas.

### Estrutura do Monorepo
```text
synergy/
├── apps/
│   ├── api/                  # Backend em Go
│   │   ├── cmd/api/          # Ponto de entrada da API (main.go)
│   │   ├── cmd/seed/         # Bootstrap do usuário Admin inicial
│   │   └── internal/         # Código privado do app (Arquitetura em Camadas)
│   │       ├── domain/       # Entidades do negócio e interfaces (sem dependências externas)
│   │       ├── usecase/      # Regras de negócio e casos de uso
│   │       ├── repository/   # Implementação de banco de dados (PostgreSQL via pgx)
│   │       │   └── migrations/  # SQL embutido no binário (aplicado na subida)
│   │       ├── handler/      # Camada HTTP (Handlers, DTOs, middlewares, router)
│   │       ├── auth/         # Detalhes técnicos de autenticação (bcrypt, JWT)
│   │       └── config/       # Leitura e validação das variáveis de ambiente
│   │
│   ├── web/                  # Frontend em React (Vite + TypeScript)
│       └── src/
│           ├── app/          # App Shell (navegação) e guards de rota
│           ├── components/   # Componentes de UI genéricos (Design System)
│           ├── features/     # Módulos por domínio (auth, teams, users, profile, sorteio)
│           │   ├── api/      # Chamadas de API específicas
│           │   ├── hooks/    # Custom hooks da feature
│           │   └── ui/       # Componentes visuais da feature
│           ├── hooks/        # Hooks genéricos reutilizáveis entre features
│           ├── services/     # Cliente HTTP global (fetch + envelope da API)
│           └── types/        # Tipos TypeScript compartilhados
│   │
│   └── e2e/                  # Testes de ponta a ponta (Playwright)
│       ├── src/              # Cliente da API, sessão e localizadores de tela
│       └── tests/
│           ├── api/          # Contrato e RBAC direto na API (sem navegador)
│           └── web/          # Fluxos de interface
│               └── com-residuo/  # Opt-in: cria registro no banco
├── PRD.md                    # Requisitos de produto
├── DESIGN-SYSTEM.md          # Design System "Neon Tokyo"
├── tasks.md                  # Backlog do MVP e status de implementação
├── README.md                 # Como rodar o projeto
└── CLAUDE.md