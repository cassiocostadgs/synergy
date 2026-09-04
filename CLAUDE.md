# 🤖 AI Guidelines & Project Conventions — Synergy

## 1. Visão Geral e Monorepo
Este é um repositório monorepo do projeto **Synergy**. O backend em Go e o frontend em React operam de forma isolada dentro de suas respectivas pastas, seguindo arquiteturas em camadas bem definidas.

### Estrutura do Monorepo
```text
synergy/
├── apps/
│   ├── api/                  # Backend em Go
│   │   ├── cmd/api/          # Ponto de entrada (main.go)
│   │   └── internal/         # Código privado do app (Arquitetura em Camadas)
│   │       ├── domain/       # Entidades do negócio e interfaces (sem dependências externas)
│   │       ├── usecase/      # Regras de negócio e casos de uso
│   │       ├── repository/   # Implementação de banco de dados (SQL, GORM, pgx)
│   │       └── handler/      # Camada HTTP (Controllers/Handlers e DTOs)
│   │
│   └── web/                  # Frontend em React (Vite + TypeScript)
│       └── src/
│           ├── components/   # Componentes de UI genéricos (Design System / Shadcn)
│           ├── features/     # Módulos por domínio (metas, time, dinâmicas)
│           │   ├── api/      # Chamadas de API específicas
│           │   ├── hooks/    # Custom hooks da feature
│           │   └── ui/       # Componentes visuais da feature
│           ├── services/     # Cliente HTTP global (Axios/Fetch)
│           └── types/        # Tipos TypeScript compartilhados
├── PRD.md
└── CLAUDE.md