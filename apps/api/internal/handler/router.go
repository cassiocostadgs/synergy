package handler

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/db1group/synergy/apps/api/internal/domain"
	"github.com/db1group/synergy/apps/api/internal/usecase"
)

// RouterConfig agrega as dependências necessárias para montar as rotas.
type RouterConfig struct {
	Auth           *usecase.AuthUseCase
	Teams          *usecase.TeamUseCase
	TokenParser    TokenParser
	Logger         *slog.Logger
	AllowedOrigins []string
}

// NewRouter monta o roteador HTTP da API.
func NewRouter(cfg RouterConfig) http.Handler {
	authHandler := NewAuthHandler(cfg.Auth)
	teamHandler := NewTeamHandler(cfg.Teams)

	router := chi.NewRouter()
	router.Use(Recoverer(cfg.Logger))
	router.Use(RequestLogger(cfg.Logger))
	router.Use(CORS(cfg.AllowedOrigins))

	router.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		respond(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	router.Route("/api/v1", func(api chi.Router) {
		// Rotas públicas
		api.Post("/auth/login", authHandler.Login)

		// Rotas autenticadas
		api.Group(func(protected chi.Router) {
			protected.Use(RequireAuth(cfg.TokenParser))

			protected.Get("/me", authHandler.Me)

			// Cadastro de usuários é exclusivo do Admin (PRD seção 2);
			// a listagem também atende o Gestor, que precisa montar seu time.
			protected.With(RequireRole(domain.RoleAdmin)).
				Post("/users", authHandler.CreateUser)
			protected.With(RequireRole(domain.RoleAdmin, domain.RoleGestor)).
				Get("/users", authHandler.ListUsers)

			protected.Route("/teams", func(teams chi.Router) {
				teams.Get("/", teamHandler.List)

				// Criar time exige papel global de Admin ou Gestor.
				teams.With(RequireRole(domain.RoleAdmin, domain.RoleGestor)).
					Post("/", teamHandler.Create)

				teams.Route("/{teamId}", func(team chi.Router) {
					team.Get("/", teamHandler.Get)
					team.Patch("/", teamHandler.Update)
					team.Post("/archive", teamHandler.Archive)
					team.Post("/transfer-principal", teamHandler.TransferPrincipal)

					// A Regra de Negócio 2 (só Gestores do próprio time) é
					// aplicada no caso de uso, que conhece o vínculo do ator
					// com este time específico.
					team.Get("/members", teamHandler.ListMembers)
					team.Post("/members", teamHandler.AddMember)
					team.Patch("/members/{userId}", teamHandler.ChangeMemberRole)
					team.Delete("/members/{userId}", teamHandler.RemoveMember)
				})
			})
		})
	})

	return router
}
