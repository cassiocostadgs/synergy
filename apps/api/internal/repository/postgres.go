package repository

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/db1group/synergy/apps/api/internal/domain"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// NewPool abre e valida o pool de conexões com o PostgreSQL.
func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("DATABASE_URL inválida: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("não foi possível criar o pool de conexões: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("não foi possível conectar ao PostgreSQL: %w", err)
	}
	return pool, nil
}

// Migrate aplica, em ordem, as migrations ainda não executadas. O controle é
// feito na tabela schema_migrations, e cada migration roda em sua própria
// transação (ou aplica tudo, ou nada).
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    text PRIMARY KEY,
			applied_at timestamptz NOT NULL DEFAULT now()
		)`); err != nil {
		return fmt.Errorf("criando schema_migrations: %w", err)
	}

	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("lendo migrations embutidas: %w", err)
	}

	versions := make([]string, 0, len(entries))
	for _, entry := range entries {
		if strings.HasSuffix(entry.Name(), ".up.sql") {
			versions = append(versions, entry.Name())
		}
	}
	sort.Strings(versions)

	for _, version := range versions {
		var exists bool
		if err := pool.QueryRow(ctx,
			`SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)`, version,
		).Scan(&exists); err != nil {
			return fmt.Errorf("verificando migration %s: %w", version, err)
		}
		if exists {
			continue
		}

		statements, err := migrationsFS.ReadFile("migrations/" + version)
		if err != nil {
			return fmt.Errorf("lendo migration %s: %w", version, err)
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("iniciando transação da migration %s: %w", version, err)
		}
		if _, err := tx.Exec(ctx, string(statements)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("aplicando migration %s: %w", version, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, version); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("registrando migration %s: %w", version, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit da migration %s: %w", version, err)
		}
	}

	return nil
}

// translate converte erros do driver em erros de domínio, para que as camadas
// superiores não precisem conhecer códigos do PostgreSQL.
func translate(err error, conflictMessage string) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.NotFound("registro não encontrado")
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
		return domain.Conflict("%s", conflictMessage)
	}
	return err
}
