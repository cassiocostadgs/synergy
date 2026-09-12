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
	motivators := repository.NewMotivatorRepository(pool)

	// Infraestrutura de autenticação
	hasher := auth.NewBcryptHasher()
	tokens := auth.NewJWTIssuer(cfg.JWTSecret, cfg.JWTTTL)

	// SSO da Microsoft é opcional: sem as variáveis do Entra, o validador fica
	// nil e a API atende apenas login por senha.
	var microsoft usecase.MicrosoftTokenValidator
	if cfg.MicrosoftSSOHabilitado() {
		microsoft = auth.NewMicrosoftValidator(cfg.MicrosoftTenantID, cfg.MicrosoftClientID)
		logger.Info("SSO da Microsoft habilitado", slog.String("tenant", cfg.MicrosoftTenantID))
	} else {
		logger.Info("SSO da Microsoft desabilitado (MS_TENANT_ID/MS_CLIENT_ID ausentes)")
	}

	// Casos de uso
	authUC := usecase.NewAuthUseCase(users, profiles, members, hasher, tokens, microsoft)
	teamUC := usecase.NewTeamUseCase(teams, members, users, motivators)
	motivatorUC := usecase.NewMotivatorUseCase(motivators)

	router := handler.NewRouter(handler.RouterConfig{
		Auth:           authUC,
		Teams:          teamUC,
		Motivators:     motivatorUC,
		TokenParser:    tokens,
		Sessions:       authUC,
		Logger:         logger,
		AllowedOrigins: cfg.AllowedOrigins,
		StaticDir:      cfg.StaticDir,
	})

	if cfg.StaticDir != "" {
		logger.Info("servindo o frontend", slog.String("diretorio", cfg.StaticDir))
	}

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
