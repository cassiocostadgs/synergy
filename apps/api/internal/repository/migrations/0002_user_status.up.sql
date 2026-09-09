-- Inativação de usuários pelo Admin (PRD seção 3.4).
--
-- Optamos por status em vez de exclusão: o histórico de participação em times
-- precisa continuar existindo, e um DELETE em users cascatearia team_members.

CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE users
    ADD COLUMN status user_status NOT NULL DEFAULT 'ACTIVE';

-- A listagem de usuários filtra e ordena por status.
CREATE INDEX users_status_idx ON users (status);
