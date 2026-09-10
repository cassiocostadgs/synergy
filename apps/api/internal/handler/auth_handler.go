package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

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

// SetUserStatus — PATCH /api/v1/users/{userId}/status (restrito ao Admin)
func (h *AuthHandler) SetUserStatus(w http.ResponseWriter, r *http.Request) {
	actor, err := requireActor(r)
	if err != nil {
		respondError(w, err)
		return
	}

	userID, err := parseUUID(chi.URLParam(r, "userId"), "userId")
	if err != nil {
		respondError(w, err)
		return
	}

	var req setUserStatusRequest
	if err := decode(r, &req); err != nil {
		respondError(w, err)
		return
	}

	user, err := h.auth.SetUserStatus(r.Context(), actor, userID, domain.UserStatus(req.Status))
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, toUserResponse(user))
}

// SetUserRole — PATCH /api/v1/users/{userId}/role (restrito ao Admin)
func (h *AuthHandler) SetUserRole(w http.ResponseWriter, r *http.Request) {
	actor, err := requireActor(r)
	if err != nil {
		respondError(w, err)
		return
	}

	userID, err := parseUUID(chi.URLParam(r, "userId"), "userId")
	if err != nil {
		respondError(w, err)
		return
	}

	var req setUserRoleRequest
	if err := decode(r, &req); err != nil {
		respondError(w, err)
		return
	}

	user, err := h.auth.SetUserRole(r.Context(), actor, userID, domain.Role(req.Role))
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, toUserResponse(user))
}

// ResetUserPassword — POST /api/v1/users/{userId}/reset-password (Admin)
//
// Responde 204 sem corpo: não há nada de útil a devolver, e a senha nunca é
// ecoada de volta.
func (h *AuthHandler) ResetUserPassword(w http.ResponseWriter, r *http.Request) {
	actor, err := requireActor(r)
	if err != nil {
		respondError(w, err)
		return
	}

	userID, err := parseUUID(chi.URLParam(r, "userId"), "userId")
	if err != nil {
		respondError(w, err)
		return
	}

	var req resetPasswordRequest
	if err := decode(r, &req); err != nil {
		respondError(w, err)
		return
	}

	if err := h.auth.ResetUserPassword(r.Context(), actor, userID, req.NewPassword); err != nil {
		respondError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
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
