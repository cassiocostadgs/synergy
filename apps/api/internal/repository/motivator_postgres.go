package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/db1group/synergy/apps/api/internal/domain"
)

// MotivatorRepository implementa domain.MotivatorRepository sobre o PostgreSQL.
type MotivatorRepository struct {
	pool *pgxpool.Pool
}

func NewMotivatorRepository(pool *pgxpool.Pool) *MotivatorRepository {
	return &MotivatorRepository{pool: pool}
}

func (r *MotivatorRepository) FindByUserID(ctx context.Context, userID uuid.UUID) (*domain.MotivatorRanking, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT motivator::text, updated_at
		FROM user_motivators
		WHERE user_id = $1
		ORDER BY rank_position`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ranking := &domain.MotivatorRanking{Ordem: []domain.Motivator{}}
	for rows.Next() {
		var (
			motivador string
			updatedAt = ranking.UpdatedAt
		)
		if err := rows.Scan(&motivador, &updatedAt); err != nil {
			return nil, err
		}
		ranking.Ordem = append(ranking.Ordem, domain.Motivator(motivador))
		// Todas as linhas são gravadas juntas, então qualquer uma serve.
		ranking.UpdatedAt = updatedAt
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Nunca preencheu: ranking vazio, não erro.
	return ranking, nil
}

func (r *MotivatorRepository) FindByUsers(
	ctx context.Context,
	userIDs []uuid.UUID,
) (map[uuid.UUID]*domain.MotivatorRanking, error) {
	rankings := map[uuid.UUID]*domain.MotivatorRanking{}
	if len(userIDs) == 0 {
		return rankings, nil
	}

	// Uma consulta só para todos os membros, em vez de uma por pessoa.
	rows, err := r.pool.Query(ctx, `
		SELECT user_id, motivator::text, updated_at
		FROM user_motivators
		WHERE user_id = ANY($1)
		ORDER BY user_id, rank_position`, userIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			userID    uuid.UUID
			motivador string
			updatedAt time.Time
		)
		if err := rows.Scan(&userID, &motivador, &updatedAt); err != nil {
			return nil, err
		}

		ranking, existe := rankings[userID]
		if !existe {
			ranking = &domain.MotivatorRanking{Ordem: []domain.Motivator{}}
			rankings[userID] = ranking
		}
		ranking.Ordem = append(ranking.Ordem, domain.Motivator(motivador))
		ranking.UpdatedAt = updatedAt
	}

	return rankings, rows.Err()
}

// Replace apaga e regrava o ranking na mesma transação. A troca em bloco evita
// o conflito com a restrição de unicidade (user_id, rank_position), que um
// UPDATE posição a posição violaria no meio do caminho.
func (r *MotivatorRepository) Replace(ctx context.Context, userID uuid.UUID, ordem []domain.Motivator) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `DELETE FROM user_motivators WHERE user_id = $1`, userID); err != nil {
		return err
	}

	for posicao, motivador := range ordem {
		if _, err := tx.Exec(ctx, `
			INSERT INTO user_motivators (user_id, motivator, rank_position)
			VALUES ($1, $2::motivator, $3)`,
			userID, string(motivador), posicao+1,
		); err != nil {
			return translate(err, "motivador repetido no ranking")
		}
	}

	return tx.Commit(ctx)
}
