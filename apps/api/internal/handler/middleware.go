package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/db1group/synergy/apps/api/internal/domain"
)

type contextKey string

const actorContextKey contextKey = "synergy.actor"

// TokenParser valida o token e devolve o ator autenticado.
type TokenParser interface {
	Parse(raw string) (domain.Actor, error)
}

// ActorFrom recupera o ator autenticado do contexto da requisição.
func ActorFrom(ctx context.Context) (domain.Actor, bool) {
	actor, ok := ctx.Value(actorContextKey).(domain.Actor)
	return actor, ok
}

// requireActor é o atalho usado pelos handlers protegidos.
func requireActor(r *http.Request) (domain.Actor, error) {
	actor, ok := ActorFrom(r.Context())
	if !ok {
		return domain.Actor{}, domain.Unauthorized("autenticação obrigatória")
	}
	return actor, nil
}

// RequireAuth exige um Bearer token válido e injeta o ator no contexto.
func RequireAuth(parser TokenParser) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			raw, found := strings.CutPrefix(header, "Bearer ")
			if !found || strings.TrimSpace(raw) == "" {
				respondError(w, domain.Unauthorized("token de acesso ausente"))
				return
			}

			actor, err := parser.Parse(strings.TrimSpace(raw))
			if err != nil {
				respondError(w, err)
				return
			}

			// O papel Auditor está reservado no schema mas fora do escopo do MVP
			// (PRD seção 5): nenhuma rota o considera autorizado.
			if !actor.Role.ImplementedInMVP() {
				respondError(w, domain.Forbidden("o papel %s não está habilitado neste MVP", actor.Role))
				return
			}

			ctx := context.WithValue(r.Context(), actorContextKey, actor)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole restringe a rota aos papéis globais informados. As regras de
// escopo por time (RN2) continuam sendo aplicadas nos casos de uso.
func RequireRole(roles ...domain.Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			actor, err := requireActor(r)
			if err != nil {
				respondError(w, err)
				return
			}
			if !slices.Contains(roles, actor.Role) {
				respondError(w, domain.Forbidden("seu papel não permite esta ação"))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// CORS libera o consumo pelo frontend (apps/web) nas origens configuradas.
func CORS(allowedOrigins []string) func(http.Handler) http.Handler {
	origins := make([]string, 0, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		if trimmed := strings.TrimSpace(origin); trimmed != "" {
			origins = append(origins, trimmed)
		}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && (slices.Contains(origins, "*") || slices.Contains(origins, origin)) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
				w.Header().Set("Access-Control-Max-Age", "300")
			}

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// statusRecorder captura o status escrito para o log de acesso.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(status int) {
	s.status = status
	s.ResponseWriter.WriteHeader(status)
}

// RequestLogger registra método, rota, status e duração de cada requisição.
func RequestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}

			next.ServeHTTP(recorder, r)

			logger.Info("http",
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", recorder.status),
				slog.Duration("duration", time.Since(start)),
			)
		})
	}
}

// Recoverer evita que um panic derrube o processo, devolvendo 500.
func Recoverer(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if recovered := recover(); recovered != nil {
					logger.Error("panic durante a requisição",
						slog.Any("panic", recovered),
						slog.String("path", r.URL.Path),
					)
					// Erro genérico (não é erro de domínio) → respondError devolve 500.
					respondError(w, errors.New("panic recuperado"))
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}
