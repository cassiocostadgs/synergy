-- Estrutura inicial do MVP (PRD seção 4).

CREATE TYPE user_role AS ENUM ('ADMIN', 'GESTOR', 'COLABORADOR', 'AUDITOR');
CREATE TYPE team_status AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE team_role AS ENUM ('GESTOR_PRINCIPAL', 'GESTOR_APOIO', 'COLABORADOR');

CREATE TABLE users (
    id            uuid PRIMARY KEY,
    name          text NOT NULL,
    email         text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role          user_role NOT NULL DEFAULT 'COLABORADOR',
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
    id      uuid PRIMARY KEY,
    user_id uuid NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    hobby   text,
    xp      integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
    level   integer NOT NULL DEFAULT 1 CHECK (level >= 1)
);

CREATE TABLE teams (
    id         uuid PRIMARY KEY,
    name       text NOT NULL,
    status     team_status NOT NULL DEFAULT 'ACTIVE',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE team_members (
    id      uuid PRIMARY KEY,
    team_id uuid NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role    team_role NOT NULL DEFAULT 'COLABORADOR',
    UNIQUE (team_id, user_id)
);

-- Regra de Negócio 1 aplicada também no banco (defesa em profundidade): no máximo
-- um Gestor Principal e um Gestor de Apoio por time. A obrigatoriedade de existir
-- exatamente um Gestor Principal é garantida pelos casos de uso, que criam o time
-- e o seu gestor na mesma transação e impedem removê-lo sem transferir a liderança.
CREATE UNIQUE INDEX team_members_single_principal
    ON team_members (team_id)
    WHERE role = 'GESTOR_PRINCIPAL';

CREATE UNIQUE INDEX team_members_single_support
    ON team_members (team_id)
    WHERE role = 'GESTOR_APOIO';

CREATE INDEX team_members_user_idx ON team_members (user_id);
