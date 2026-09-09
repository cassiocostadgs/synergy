// Command seed cria o usuário Admin inicial, necessário para o bootstrap do
// sistema (o cadastro de usuários é exclusivo do Admin — PRD seção 2).
//
// Uso: SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... go run ./cmd/seed
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/google/uuid"

	"github.com/db1group/synergy/apps/api/internal/auth"
	"github.com/db1group/synergy/apps/api/internal/config"
	"github.com/db1group/synergy/apps/api/internal/domain"
	"github.com/db1group/synergy/apps/api/internal/repository"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	if err := run(logger); err != nil {
		logger.Error("falha no seed", slog.Any("erro", err))
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	name := envOr("SEED_ADMIN_NAME", "Admin Synergy")
	email := envOr("SEED_ADMIN_EMAIL", "admin@synergy.dev")
	password := os.Getenv("SEED_ADMIN_PASSWORD")
	if len(password) < 8 {
		return fmt.Errorf("SEED_ADMIN_PASSWORD é obrigatória e precisa de ao menos 8 caracteres")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := repository.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	if err := repository.Migrate(ctx, pool); err != nil {
		return err
	}

	users := repository.NewUserRepository(pool)

	if existing, err := users.FindByEmail(ctx, email); err == nil {
		logger.Info("admin já existe, nada a fazer",
			slog.String("email", existing.Email),
			slog.String("id", existing.ID.String()),
		)
		return nil
	} else if !domain.IsNotFound(err) {
		return err
	}

	hash, err := auth.NewBcryptHasher().Hash(password)
	if err != nil {
		return err
	}

	admin := &domain.User{
		ID:           uuid.New(),
		Name:         name,
		Email:        email,
		PasswordHash: hash,
		Role:         domain.RoleAdmin,
		Status:       domain.UserStatusActive,
		CreatedAt:    time.Now().UTC(),
	}
	profile := &domain.Profile{
		ID:     uuid.New(),
		UserID: admin.ID,
		XP:     0,
		Level:  1,
	}

	if err := users.Create(ctx, admin, profile); err != nil {
		return err
	}

	logger.Info("admin criado",
		slog.String("email", admin.Email),
		slog.String("id", admin.ID.String()),
	)
	return nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
