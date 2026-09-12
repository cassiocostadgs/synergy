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
	Motivators     *usecase.MotivatorUseCase
	TokenParser    TokenParser
	Sessions       SessionValidator
	Logger         *slog.Logger
	AllowedOrigins []string
	// StaticDir, quando preenchido, faz a API também servir o frontend a partir
	// desse diretório. É o modo de container único, em que não há nginx na
	// frente. Vazio em desenvolvimento: lá quem serve o front é o Vite.
	StaticDir string
}

// NewRouter monta o roteador HTTP da API.
func NewRouter(cfg RouterConfig) http.Handler {
	authHandler := NewAuthHandler(cfg.Auth)
	teamHandler := NewTeamHandler(cfg.Teams)
	motivatorHandler := NewMotivatorHandler(cfg.Motivators)

	router := chi.NewRouter()
	router.Use(Recoverer(cfg.Logger))
	router.Use(RequestLogger(cfg.Logger))
	router.Use(CORS(cfg.AllowedOrigins))

	// Respostas de rota/método inválidos seguem o envelope da API — sem isso o
	// chi devolveria texto puro no 404 e corpo vazio no 405, quebrando o
	// contrato que o frontend espera.
	router.MethodNotAllowed(func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusMethodNotAllowed, envelope{
			Error: &errorBody{
				Code:    "METHOD_NOT_ALLOWED",
				Message: "método não permitido para esta rota",
			},
		})
	})

	if cfg.StaticDir == "" {
		router.NotFound(func(w http.ResponseWriter, _ *http.Request) {
			respondError(w, domain.NotFound("rota não encontrada"))
		})

		// Sem frontend embarcado, a raiz identifica o serviço: quem abre a URL da
		// API no navegador recebe uma resposta útil em vez de um 404 sem explicação.
		router.Get("/", func(w http.ResponseWriter, _ *http.Request) {
			respond(w, http.StatusOK, map[string]any{
				"service": "Synergy API",
				"endpoints": map[string]string{
					"health": "/health",
					"api":    "/api/v1",
				},
			})
		})
	} else {
		// Com o frontend embarcado, tudo que não é rota conhecida vira tentativa
		// de servir arquivo — e, no fim, o index.html. O handler devolve o
		// envelope de erro para caminhos sob /api/, que são engano de chamada e
		// não navegação.
		estaticos := spaHandler(cfg.StaticDir)
		router.NotFound(estaticos)
		router.Get("/", estaticos)
	}

	router.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		respond(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	router.Route("/api/v1", func(api chi.Router) {
		// Rotas públicas
		api.Post("/auth/login", authHandler.Login)
		// SSO da Microsoft. Pública como o login por senha: é ela que cria a
		// sessão. Responde 403 quando o SSO não está configurado no ambiente.
		api.Post("/auth/microsoft", authHandler.LoginMicrosoft)

		// Rotas autenticadas
		api.Group(func(protected chi.Router) {
			protected.Use(RequireAuth(cfg.TokenParser, cfg.Sessions))

			// Autogestão do próprio cadastro: qualquer papel autenticado.
			protected.Get("/me", authHandler.Me)
			protected.Patch("/me", authHandler.UpdateMe)
			protected.Patch("/me/password", authHandler.ChangePassword)

			// Moving Motivators do próprio usuário (PRD seção 3.2.3).
			protected.Get("/me/motivators", motivatorHandler.Get)
			protected.Put("/me/motivators", motivatorHandler.Save)

			// Cadastro de usuários é exclusivo do Admin (PRD seção 2);
			// a listagem também atende o Gestor, que precisa montar seu time.
			protected.With(RequireRole(domain.RoleAdmin)).
				Post("/users", authHandler.CreateUser)
			protected.With(RequireRole(domain.RoleAdmin, domain.RoleGestor)).
				Get("/users", authHandler.ListUsers)
			// Gestão de acessos: exclusiva do Admin (PRD seção 3.4).
			protected.With(RequireRole(domain.RoleAdmin)).
				Patch("/users/{userId}/status", authHandler.SetUserStatus)
			protected.With(RequireRole(domain.RoleAdmin)).
				Patch("/users/{userId}/role", authHandler.SetUserRole)
			protected.With(RequireRole(domain.RoleAdmin)).
				Post("/users/{userId}/reset-password", authHandler.ResetUserPassword)

			protected.Route("/teams", func(teams chi.Router) {
				teams.Get("/", teamHandler.List)

				// Radar consolidado dos times que a pessoa gere. Segmento fixo,
				// então o chi resolve antes de /{teamId} — não há ambiguidade
				// com um time chamado "motivators".
				teams.With(RequireRole(domain.RoleAdmin, domain.RoleGestor)).
					Get("/motivators", teamHandler.MotivatorsGeral)

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
					// Radar do time: só Gestores do próprio time e Admin. A
					// checagem de vínculo fica no caso de uso, que conhece o
					// papel do ator neste time específico.
					team.With(RequireRole(domain.RoleAdmin, domain.RoleGestor)).
						Get("/motivators", teamHandler.Motivators)

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
