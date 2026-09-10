-- Moving Motivators (PRD seção 3.2.3): cada pessoa ordena os 10 motivadores
-- da prática do Management 3.0 conforme as próprias prioridades.

CREATE TYPE motivator AS ENUM (
    'CURIOSIDADE',
    'LIBERDADE',
    'PROPOSITO',
    'MAESTRIA',
    'RELACOES',
    'HONRA',
    'ACEITACAO',
    'ORDEM',
    'PODER',
    'STATUS'
);

-- Modelo normalizado (uma linha por motivador) em vez de um JSON com a lista:
--   * o banco garante que ninguém repete motivador nem posição;
--   * agregações futuras por time ("o que mais move este time?") saem em SQL.
CREATE TABLE user_motivators (
    user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    motivator     motivator NOT NULL,
    rank_position smallint NOT NULL CHECK (rank_position BETWEEN 1 AND 10),
    updated_at    timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, motivator),
    -- Duas prioridades não podem ocupar a mesma posição.
    UNIQUE (user_id, rank_position)
);
