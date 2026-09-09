// Command api é o ponto de entrada da API do Synergy.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/db1group/synergy/apps/api/internal/auth"
	"github.com/db1group/synergy/apps/api/internal/config"
	"github.com/db1group/synergy/apps/api/internal/handler"
	"github.com/db1group/synergy/apps/api/internal/repository"
	"github.com/db1group/synergy/apps/api/internal/usecase"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	if err := run(logger); err != nil {
		logger.Error("falha ao iniciar a API", slog.Any("erro", err))
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := repository.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	if err := repository.Migrate(ctx, pool); err != nil {
		return err
	}
	logger.Info("migrations aplicadas")

	// Camada de persistência
	users := repository.NewUserRepository(pool)
	profiles := repository.NewProfileRepository(pool)
	teams := repository.NewTeamRepository(pool)
	members := repository.NewTeamMemberRepository(pool)

	// Infraestrutura de autenticação
	hasher := auth.NewBcryptHasher()
	tokens := auth.NewJWTIssuer(cfg.JWTSecret, cfg.JWTTTL)

	// Casos de uso
	authUC := usecase.NewAuthUseCase(users, profiles, hasher, tokens)
	teamUC := usecase.NewTeamUseCase(teams, members, users)

	router := handler.NewRouter(handler.RouterConfig{
		Auth:           authUC,
		Teams:          teamUC,
		TokenParser:    tokens,
		Logger:         logger,
		AllowedOrigins: cfg.AllowedOrigins,
	})

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		logger.Info("API ouvindo", slog.String("addr", server.Addr))
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	select {
	case err := <-serverErr:
		return err
	case <-ctx.Done():
		logger.Info("encerrando a API")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return server.Shutdown(shutdownCtx)
}
