package handler

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/db1group/synergy/apps/api/internal/domain"
	"github.com/db1group/synergy/apps/api/internal/usecase"
)

// TeamHandler expõe o Épico 3.1 (Gestão de Times e Membros) via HTTP.
type TeamHandler struct {
	teams *usecase.TeamUseCase
}

func NewTeamHandler(teams *usecase.TeamUseCase) *TeamHandler {
	return &TeamHandler{teams: teams}
}

// Create — POST /api/v1/teams
func (h *TeamHandler) Create(w http.ResponseWriter, r *http.Request) {
	actor, err := requireActor(r)
	if err != nil {
		respondError(w, err)
		return
	}

	var req createTeamRequest
	if err := decode(r, &req); err != nil {
		respondError(w, err)
		return
	}

	// principalUserId é opcional: um Gestor assume a liderança do time que cria.
	principalID := uuid.Nil
	if req.PrincipalUserID != "" {
		principalID, err = parseUUID(req.PrincipalUserID, "principalUserId")
		if err != nil {
			respondError(w, err)
			return
		}
	}

	team, err := h.teams.Create(r.Context(), actor, usecase.CreateTeamInput{
		Name:            req.Name,
		PrincipalUserID: principalID,
	})
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusCreated, toTeamResponse(team))
}

// List — GET /api/v1/teams
func (h *TeamHandler) List(w http.ResponseWriter, r *http.Request) {
	actor, err := requireActor(r)
	if err != nil {
		respondError(w, err)
		return
	}

	teams, err := h.teams.List(r.Context(), actor)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, toTeamsComPapelResponse(teams))
}

// Get — GET /api/v1/teams/{teamId}
func (h *TeamHandler) Get(w http.ResponseWriter, r *http.Request) {
	actor, teamID, err := h.actorAndTeam(r)
	if err != nil {
		respondError(w, err)
		return
	}

	team, err := h.teams.Get(r.Context(), actor, teamID)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, toTeamResponse(team))
}

// Update — PATCH /api/v1/teams/{teamId}
func (h *TeamHandler) Update(w http.ResponseWriter, r *http.Request) {
	actor, teamID, err := h.actorAndTeam(r)
	if err != nil {
		respondError(w, err)
		return
	}

	var req updateTeamRequest
	if err := decode(r, &req); err != nil {
		respondError(w, err)
		return
	}

	team, err := h.teams.Update(r.Context(), actor, teamID, req.Name)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, toTeamResponse(team))
}

// Archive — POST /api/v1/teams/{teamId}/archive
func (h *TeamHandler) Archive(w http.ResponseWriter, r *http.Request) {
	actor, teamID, err := h.actorAndTeam(r)
	if err != nil {
		respondError(w, err)
		return
	}

	team, err := h.teams.Archive(r.Context(), actor, teamID)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, toTeamResponse(team))
}

// Motivators — GET /api/v1/teams/{teamId}/motivators
//
// O "Radar" do time: placar agregado dos Moving Motivators. Restrito aos
// Gestores do próprio time e ao Admin; Colaborador não tem acesso.
func (h *TeamHandler) Motivators(w http.ResponseWriter, r *http.Request) {
	actor, teamID, err := h.actorAndTeam(r)
	if err != nil {
		respondError(w, err)
		return
	}

	visao, err := h.teams.MotivatorsOverview(r.Context(), actor, teamID, time.Now().UTC())
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, toTeamMotivatorsResponse(visao))
}

// MotivatorsGeral — GET /api/v1/teams/motivators
//
// Radar consolidado de todos os times que a pessoa gere (todos os ativos, no
// caso do Admin). Cada pessoa conta uma vez, mesmo participando de dois times.
func (h *TeamHandler) MotivatorsGeral(w http.ResponseWriter, r *http.Request) {
	actor, err := requireActor(r)
	if err != nil {
		respondError(w, err)
		return
	}

	visao, err := h.teams.MotivatorsOverviewGeral(r.Context(), actor, time.Now().UTC())
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, toConsolidatedMotivatorsResponse(visao))
}

// ListMembers — GET /api/v1/teams/{teamId}/members
func (h *TeamHandler) ListMembers(w http.ResponseWriter, r *http.Request) {
	actor, teamID, err := h.actorAndTeam(r)
	if err != nil {
		respondError(w, err)
		return
	}

	members, err := h.teams.ListMembers(r.Context(), actor, teamID)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, toMemberResponses(members))
}

// AddMember — POST /api/v1/teams/{teamId}/members
func (h *TeamHandler) AddMember(w http.ResponseWriter, r *http.Request) {
	actor, teamID, err := h.actorAndTeam(r)
	if err != nil {
		respondError(w, err)
		return
	}

	var req addMemberRequest
	if err := decode(r, &req); err != nil {
		respondError(w, err)
		return
	}

	userID, err := parseUUID(req.UserID, "userId")
	if err != nil {
		respondError(w, err)
		return
	}

	role := domain.TeamRole(req.Role)
	if req.Role == "" {
		role = domain.TeamRoleColaborador
	}

	member, err := h.teams.AddMember(r.Context(), actor, teamID, userID, role)
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusCreated, memberResponse{
		UserID: member.UserID.String(),
		Role:   string(member.Role),
	})
}

// ChangeMemberRole — PATCH /api/v1/teams/{teamId}/members/{userId}
func (h *TeamHandler) ChangeMemberRole(w http.ResponseWriter, r *http.Request) {
	actor, teamID, err := h.actorAndTeam(r)
	if err != nil {
		respondError(w, err)
		return
	}

	userID, err := parseUUID(chi.URLParam(r, "userId"), "userId")
	if err != nil {
		respondError(w, err)
		return
	}

	var req changeMemberRoleRequest
	if err := decode(r, &req); err != nil {
		respondError(w, err)
		return
	}

	member, err := h.teams.ChangeMemberRole(r.Context(), actor, teamID, userID, domain.TeamRole(req.Role))
	if err != nil {
		respondError(w, err)
		return
	}

	respond(w, http.StatusOK, memberResponse{
		UserID: member.UserID.String(),
		Role:   string(member.Role),
	})
}

// RemoveMember — DELETE /api/v1/teams/{teamId}/members/{userId}
func (h *TeamHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	actor, teamID, err := h.actorAndTeam(r)
	if err != nil {
		respondError(w, err)
		return
	}

	userID, err := parseUUID(chi.URLParam(r, "userId"), "userId")
	if err != nil {
		respondError(w, err)
		return
	}

	if err := h.teams.RemoveMember(r.Context(), actor, teamID, userID); err != nil {
		respondError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// TransferPrincipal — POST /api/v1/teams/{teamId}/transfer-principal
func (h *TeamHandler) TransferPrincipal(w http.ResponseWriter, r *http.Request) {
	actor, teamID, err := h.actorAndTeam(r)
	if err != nil {
		respondError(w, err)
		return
	}

	var req transferPrincipalRequest
	if err := decode(r, &req); err != nil {
		respondError(w, err)
		return
	}

	userID, err := parseUUID(req.UserID, "userId")
	if err != nil {
		respondError(w, err)
		return
	}

	if err := h.teams.TransferPrincipal(r.Context(), actor, teamID, userID); err != nil {
		respondError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// actorAndTeam extrai o ator autenticado e o teamId da rota.
func (h *TeamHandler) actorAndTeam(r *http.Request) (domain.Actor, uuid.UUID, error) {
	actor, err := requireActor(r)
	if err != nil {
		return domain.Actor{}, uuid.Nil, err
	}
	teamID, err := parseUUID(chi.URLParam(r, "teamId"), "teamId")
	if err != nil {
		return domain.Actor{}, uuid.Nil, err
	}
	return actor, teamID, nil
}
