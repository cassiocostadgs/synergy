package handler

import (
	"net/http"

	"github.com/db1group/synergy/apps/api/internal/domain"
	"github.com/db1group/synergy/apps/api/internal/usecase"
)

// AuthHandler expõe autenticação, perfil próprio e cadastro de usuários.
type AuthHandler struct {
	auth *usecase.AuthUseCase
}

func NewAuthHandler(auth *usecase.AuthUseCase) *AuthHandler {
	return &AuthHandler{auth: auth}
}

// Login — POST /api/v1/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := decode(r, &req); err != nil {
		respondError(w, err)
		return
	}

	out, err := h.auth.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, loginResponse{
		Token:     out.Token,
		ExpiresAt: out.ExpiresAt,
		User:      toUserResponse(out.User),
	})
}

// Me — GET /api/v1/me (perfil próprio, com XP e nível)
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	actor, err := requireActor(r)
	if err != nil {
		respondError(w, err)
		return
	}

	out, err := h.auth.Me(r.Context(), actor)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, toMeResponse(out))
}

// UpdateMe — PATCH /api/v1/me (o usuário edita os próprios dados)
func (h *AuthHandler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	actor, err := requireActor(r)
	if err != nil {
		respondError(w, err)
		return
	}

	var req updateMeRequest
	if err := decode(r, &req); err != nil {
		respondError(w, err)
		return
	}

	out, err := h.auth.UpdateMe(r.Context(), actor, usecase.UpdateMeInput{
		Name:  req.Name,
		Hobby: req.Hobby,
	})
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, toMeResponse(out))
}

// ChangePassword — PATCH /api/v1/me/password (exige a senha atual)
func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	actor, err := requireActor(r)
	if err != nil {
		respondError(w, err)
		return
	}

	var req changePasswordRequest
	if err := decode(r, &req); err != nil {
		respondError(w, err)
		return
	}

	if err := h.auth.ChangePassword(r.Context(), actor, req.CurrentPassword, req.NewPassword); err != nil {
		respondError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// CreateUser — POST /api/v1/users (restrito ao Admin)
func (h *AuthHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	actor, err := requireActor(r)
	if err != nil {
		respondError(w, err)
		return
	}

	var req createUserRequest
	if err := decode(r, &req); err != nil {
		respondError(w, err)
		return
	}

	user, err := h.auth.CreateUser(r.Context(), actor, usecase.CreateUserInput{
		Name:     req.Name,
		Email:    req.Email,
		Password: req.Password,
		Role:     domain.Role(req.Role),
		Hobby:    req.Hobby,
	})
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusCreated, toUserResponse(user))
}

// ListUsers — GET /api/v1/users (Admin e Gestor, para montar o time)
func (h *AuthHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	actor, err := requireActor(r)
	if err != nil {
		respondError(w, err)
		return
	}

	users, err := h.auth.ListUsers(r.Context(), actor)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, toUserResponses(users))
}
