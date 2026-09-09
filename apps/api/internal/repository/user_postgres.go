package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/db1group/synergy/apps/api/internal/domain"
)

// UserRepository implementa domain.UserRepository sobre o PostgreSQL.
type UserRepository struct {
	pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

// Create grava usuário e perfil na mesma transação: todo usuário nasce com um
// perfil de gamificação (XP 0 / nível 1).
func (r *UserRepository) Create(ctx context.Context, user *domain.User, profile *domain.Profile) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `
		INSERT INTO users (id, name, email, password_hash, role, created_at)
		VALUES ($1, $2, $3, $4, $5::user_role, $6)`,
		user.ID, user.Name, user.Email, user.PasswordHash, string(user.Role), user.CreatedAt,
	); err != nil {
		return translate(err, "já existe um usuário com este e-mail")
	}

	if profile != nil {
		if _, err := tx.Exec(ctx, `
			INSERT INTO profiles (id, user_id, hobby, xp, level)
			VALUES ($1, $2, NULLIF($3, ''), $4, $5)`,
			profile.ID, profile.UserID, profile.Hobby, profile.XP, profile.Level,
		); err != nil {
			return translate(err, "já existe um perfil para este usuário")
		}
	}

	return tx.Commit(ctx)
}

const userColumns = `id, name, email, password_hash, role::text, created_at`

func (r *UserRepository) FindByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	return r.queryUser(ctx, `SELECT `+userColumns+` FROM users WHERE id = $1`, id)
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	return r.queryUser(ctx, `SELECT `+userColumns+` FROM users WHERE email = $1`, email)
}

func (r *UserRepository) List(ctx context.Context) ([]domain.User, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+userColumns+` FROM users ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []domain.User{}
	for rows.Next() {
		user, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, *user)
	}
	return users, rows.Err()
}

func (r *UserRepository) queryUser(ctx context.Context, query string, args ...any) (*domain.User, error) {
	user, err := scanUser(r.pool.QueryRow(ctx, query, args...))
	if err != nil {
		return nil, translate(err, "conflito ao consultar usuário")
	}
	return user, nil
}

// scanner cobre tanto pgx.Row quanto pgx.Rows.
type scanner interface {
	Scan(dest ...any) error
}

func scanUser(row scanner) (*domain.User, error) {
	var (
		user domain.User
		role string
	)
	if err := row.Scan(&user.ID, &user.Name, &user.Email, &user.PasswordHash, &role, &user.CreatedAt); err != nil {
		return nil, err
	}
	user.Role = domain.Role(role)
	return &user, nil
}

// ProfileRepository implementa domain.ProfileRepository sobre o PostgreSQL.
type ProfileRepository struct {
	pool *pgxpool.Pool
}

func NewProfileRepository(pool *pgxpool.Pool) *ProfileRepository {
	return &ProfileRepository{pool: pool}
}

func (r *ProfileRepository) FindByUserID(ctx context.Context, userID uuid.UUID) (*domain.Profile, error) {
	var profile domain.Profile
	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, COALESCE(hobby, ''), xp, level
		FROM profiles
		WHERE user_id = $1`, userID,
	).Scan(&profile.ID, &profile.UserID, &profile.Hobby, &profile.XP, &profile.Level)
	if err != nil {
		return nil, translate(err, "conflito ao consultar perfil")
	}
	return &profile, nil
}
